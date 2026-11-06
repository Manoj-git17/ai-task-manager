const { createClient } = require("@libsql/client");
const path = require("path");
const fs = require("fs");

function normalizeArgs(rawArgs) {
  if (rawArgs.length === 0) return [];
  if (rawArgs.length === 1 && Array.isArray(rawArgs[0])) {
    return rawArgs[0];
  }
  return rawArgs;
}

let dbInstance = null;

async function initializeDB() {
  if (dbInstance) {
    return dbInstance;
  }

  const isTurso = Boolean(process.env.TURSO_DATABASE_URL);
  let client;

  if (isTurso) {
    console.log("[Database] Connecting to remote Turso database...");
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  } else {
    const filename = process.env.DB_PATH || path.join(__dirname, "tasks.db");
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const fileUrl = `file:${filename.replace(/\\/g, "/")}`;
    console.log(`[Database] Connecting to local SQLite file (${fileUrl})...`);
    client = createClient({
      url: fileUrl,
    });
  }

  // Safe PRAGMA configurations (handled safely if unsupported over remote HTTP)
  try {
    await client.execute("PRAGMA foreign_keys = ON;");
  } catch {
    // Ignored if remote protocol doesn't support PRAGMA
  }

  try {
    await client.execute("PRAGMA busy_timeout = 5000;");
  } catch {
    // Ignored if remote protocol doesn't support PRAGMA
  }

  // Create core schema if not existing
  await client.executeMultiple(`
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

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id
      ON tasks(userId);

    CREATE INDEX IF NOT EXISTS idx_tasks_user_created
      ON tasks(userId, id DESC);

    CREATE INDEX IF NOT EXISTS idx_goals_user_id
      ON goals(userId);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase
      ON users(email COLLATE NOCASE);
  `);

  // Safe migrations for legacy databases
  try {
    await client.execute("ALTER TABLE tasks ADD COLUMN completedAt TEXT;");
  } catch {
    // Column already exists
  }

  try {
    await client.execute("ALTER TABLE users ADD COLUMN avatar TEXT;");
  } catch {
    // Column already exists
  }

  try {
    await client.execute("ALTER TABLE users ADD COLUMN createdAt TEXT;");
  } catch {
    // Column already exists
  }

  try {
    await client.execute(
      "ALTER TABLE tasks ADD COLUMN workspace TEXT DEFAULT 'Engineering Core';"
    );
  } catch {
    // Column already exists
  }

  let activeTx = null;

  const db = {
    client,
    rawClient: client,

    async get(sql, ...rawArgs) {
      const args = normalizeArgs(rawArgs);
      const executor = activeTx || client;
      const res = await executor.execute({ sql, args });
      return res.rows.length > 0 ? { ...res.rows[0] } : undefined;
    },

    async all(sql, ...rawArgs) {
      const args = normalizeArgs(rawArgs);
      const executor = activeTx || client;
      const res = await executor.execute({ sql, args });
      return res.rows.map((row) => ({ ...row }));
    },

    async run(sql, ...rawArgs) {
      const trimmed = sql.trim().toUpperCase().replace(/;$/, "");
      if (trimmed === "BEGIN" || trimmed === "BEGIN TRANSACTION") {
        activeTx = await client.transaction("write");
        return { changes: 0 };
      }
      if (trimmed === "COMMIT") {
        if (activeTx) {
          await activeTx.commit();
          activeTx = null;
        }
        return { changes: 0 };
      }
      if (trimmed === "ROLLBACK") {
        if (activeTx) {
          await activeTx.rollback();
          activeTx = null;
        }
        return { changes: 0 };
      }

      const args = normalizeArgs(rawArgs);
      const executor = activeTx || client;
      const res = await executor.execute({ sql, args });
      const lastID =
        res.lastInsertRowid !== undefined && res.lastInsertRowid !== null
          ? Number(res.lastInsertRowid)
          : undefined;

      return {
        lastID,
        lastInsertRowid: res.lastInsertRowid,
        changes: res.rowsAffected || 0,
        rowsAffected: res.rowsAffected || 0,
      };
    },

    async exec(sql) {
      return await client.executeMultiple(sql);
    },

    async close() {
      if (activeTx) {
        try {
          await activeTx.rollback();
        } catch {
          // Ignored
        }
        activeTx = null;
      }
      if (typeof client.close === "function") {
        client.close();
      }
      dbInstance = null;
    },
  };

  dbInstance = db;
  return dbInstance;
}

module.exports = initializeDB;
