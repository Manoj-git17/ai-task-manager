/**
 * TaskFlow - Safe Local SQLite to Turso Cloud Database Migration Script
 *
 * Copies existing user accounts, tasks, and productivity goals from the local
 * backend/tasks.db file into your persistent Turso cloud database.
 *
 * Usage:
 *   node backend/migrate_to_turso.js          (Dry-run mode: checks and prints counts only)
 *   node backend/migrate_to_turso.js --apply  (Execute mode: copies records safely)
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { createClient } = require("@libsql/client");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function runMigration() {
  const isApply = process.argv.includes("--apply");
  const localDbPath = process.env.DB_PATH || path.join(__dirname, "tasks.db");
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  console.log("==================================================================");
  console.log("      TASKFLOW LOCAL SQLITE -> TURSO CLOUD DATA MIGRATION        ");
  console.log("==================================================================\n");

  if (!fs.existsSync(localDbPath)) {
    console.error(`[Error] Local database file not found at: ${localDbPath}`);
    process.exit(1);
  }

  if (!tursoUrl) {
    console.error("[Error] TURSO_DATABASE_URL is not set in environment or .env file.");
    console.log("\nTo migrate, set your Turso credentials in backend/.env:");
    console.log("  TURSO_DATABASE_URL=libsql://your-db-name-your-org.turso.io");
    console.log("  TURSO_AUTH_TOKEN=your_token_here");
    console.log("\nOr pass them inline:");
    console.log("  TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node backend/migrate_to_turso.js\n");
    process.exit(1);
  }

  console.log(`[Source] Local SQLite Database: ${localDbPath}`);
  console.log(`[Target] Turso Database URL:   ${tursoUrl}`);
  console.log(`[Mode]   ${isApply ? "EXECUTE (--apply flag active)" : "DRY RUN (Preview only)"}\n`);

  // Open Local SQLite Source
  const localDb = await open({
    filename: localDbPath,
    driver: sqlite3.Database,
  });

  // Open Remote Turso Target
  const tursoClient = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  // Ensure tables and indexes exist on Turso
  await tursoClient.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password TEXT NOT NULL,
      avatar TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      favorite INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'Medium',
      dueDate TEXT,
      createdAt TEXT NOT NULL,
      userId INTEGER NOT NULL,
      completedAt TEXT,
      workspace TEXT DEFAULT 'Engineering Core',
      FOREIGN KEY (userId)
        REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      targetCount INTEGER NOT NULL DEFAULT 5,
      category TEXT DEFAULT 'all',
      targetDate TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      userId INTEGER NOT NULL,
      FOREIGN KEY (userId)
        REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase
      ON users(email COLLATE NOCASE);
  `);

  // Fetch local records
  const localUsers = await localDb.all("SELECT * FROM users ORDER BY id ASC");
  let localTasks = [];
  let localGoals = [];
  try {
    localTasks = await localDb.all("SELECT * FROM tasks ORDER BY id ASC");
  } catch {
    // Tasks table empty or absent
  }
  try {
    localGoals = await localDb.all("SELECT * FROM goals ORDER BY id ASC");
  } catch {
    // Goals table empty or absent
  }

  // Fetch existing Turso records
  const tursoUsersRes = await tursoClient.execute("SELECT id, email FROM users");
  const existingUserIds = new Set(tursoUsersRes.rows.map((r) => r.id));
  const existingUserEmails = new Set(
    tursoUsersRes.rows.map((r) => String(r.email || "").toLowerCase())
  );

  const tursoTasksRes = await tursoClient.execute("SELECT id FROM tasks");
  const existingTaskIds = new Set(tursoTasksRes.rows.map((r) => r.id));

  const tursoGoalsRes = await tursoClient.execute("SELECT id FROM goals");
  const existingGoalIds = new Set(tursoGoalsRes.rows.map((r) => r.id));

  // Determine delta to insert
  const usersToInsert = localUsers.filter(
    (u) =>
      !existingUserIds.has(u.id) &&
      !existingUserEmails.has(String(u.email || "").toLowerCase())
  );
  const tasksToInsert = localTasks.filter((t) => !existingTaskIds.has(t.id));
  const goalsToInsert = localGoals.filter((g) => !existingGoalIds.has(g.id));

  console.log("------------------------------------------------------------------");
  console.log("Table Name   | Local Count | Turso Existing | Ready to Migrate");
  console.log("------------------------------------------------------------------");
  console.log(
    `users        | ${String(localUsers.length).padEnd(11)} | ${String(existingUserIds.size).padEnd(14)} | ${usersToInsert.length}`
  );
  console.log(
    `tasks        | ${String(localTasks.length).padEnd(11)} | ${String(existingTaskIds.size).padEnd(14)} | ${tasksToInsert.length}`
  );
  console.log(
    `goals        | ${String(localGoals.length).padEnd(11)} | ${String(existingGoalIds.size).padEnd(14)} | ${goalsToInsert.length}`
  );
  console.log("------------------------------------------------------------------\n");

  if (!isApply) {
    console.log("ℹ️ [DRY RUN] No changes were made to your Turso database.");
    console.log("To apply the migration and copy all records, execute:");
    console.log("  node backend/migrate_to_turso.js --apply\n");
    await localDb.close();
    tursoClient.close();
    return;
  }

  console.log("[MIGRATING] Writing records into Turso...");

  // 1. Insert Users
  let usersAdded = 0;
  for (const u of usersToInsert) {
    await tursoClient.execute({
      sql: `INSERT INTO users (id, name, email, password, avatar, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        u.id,
        u.name,
        String(u.email || "").toLowerCase().trim(),
        u.password,
        u.avatar || null,
        u.createdAt || new Date().toISOString(),
      ],
    });
    usersAdded++;
  }
  console.log(`✓ Migrated ${usersAdded} users into Turso.`);

  // 2. Insert Tasks
  let tasksAdded = 0;
  for (const t of tasksToInsert) {
    await tursoClient.execute({
      sql: `INSERT INTO tasks (
              id, task, completed, favorite, priority, dueDate, createdAt, userId, completedAt, workspace
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        t.id,
        t.task,
        t.completed ? 1 : 0,
        t.favorite ? 1 : 0,
        t.priority || "Medium",
        t.dueDate || null,
        t.createdAt || new Date().toISOString(),
        t.userId,
        t.completedAt || null,
        t.workspace || "Engineering Core",
      ],
    });
    tasksAdded++;
  }
  console.log(`✓ Migrated ${tasksAdded} tasks into Turso.`);

  // 3. Insert Goals
  let goalsAdded = 0;
  for (const g of goalsToInsert) {
    await tursoClient.execute({
      sql: `INSERT INTO goals (id, title, targetCount, category, targetDate, createdAt, userId)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        g.id,
        g.title,
        g.targetCount || 5,
        g.category || "all",
        g.targetDate || null,
        g.createdAt || new Date().toISOString(),
        g.userId,
      ],
    });
    goalsAdded++;
  }
  console.log(`✓ Migrated ${goalsAdded} goals into Turso.`);

  // Final verification counts
  const finalUsers = await tursoClient.execute("SELECT count(*) as count FROM users");
  const finalTasks = await tursoClient.execute("SELECT count(*) as count FROM tasks");
  const finalGoals = await tursoClient.execute("SELECT count(*) as count FROM goals");

  console.log("\n================ MIGRATION COMPLETE ================");
  console.log(`Final Turso Users: ${finalUsers.rows[0].count}`);
  console.log(`Final Turso Tasks: ${finalTasks.rows[0].count}`);
  console.log(`Final Turso Goals: ${finalGoals.rows[0].count}`);
  console.log("====================================================\n");

  await localDb.close();
  tursoClient.close();
}

runMigration().catch((err) => {
  console.error("\n[FATAL] Migration script failed:", err.message);
  process.exit(1);
});
