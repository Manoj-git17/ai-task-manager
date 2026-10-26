const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const fs = require("fs");

async function initializeDB() {
  // Use a configured database path when available.
  // Otherwise, store the database inside the backend folder.
  const filename =
    process.env.DB_PATH || path.join(__dirname, "tasks.db");

  // Ensure the database directory exists.
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  const db = await open({
    filename,
    driver: sqlite3.Database,
  });

  // Enable foreign-key constraints.
  await db.exec("PRAGMA foreign_keys = ON;");

  // Enable WAL (Write-Ahead Logging) journal mode for superior concurrency and durability
  await db.exec("PRAGMA journal_mode = WAL;");

  // Wait briefly if the database is busy.
  await db.exec("PRAGMA busy_timeout = 5000;");

  // Create tables if they don't already exist.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
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
  `);

  try {
    await db.exec("ALTER TABLE tasks ADD COLUMN completedAt TEXT;");
  } catch {
    // Column already exists
  }

  try {
    await db.exec("ALTER TABLE users ADD COLUMN avatar TEXT;");
  } catch {
    // Column already exists
  }

  try {
    await db.exec("ALTER TABLE users ADD COLUMN createdAt TEXT;");
  } catch {
    // Column already exists
  }

  try {
    await db.exec("ALTER TABLE tasks ADD COLUMN workspace TEXT DEFAULT 'Engineering Core';");
  } catch {
    // Column already exists
  }

  return db;
}

module.exports = initializeDB;
