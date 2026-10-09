const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function initializeDB() {
  const db = await open({
    filename: "./tasks.db",
    driver: sqlite3.Database,
  });

  return db;
}

module.exports = initializeDB;