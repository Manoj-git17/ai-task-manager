const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

async function initializeDB() {
  const db = await open({
    filename: path.join(__dirname, "tasks.db"),
    driver: sqlite3.Database,
  });

  return db;
}

module.exports = initializeDB;