/**
 * TaskFlow - Safe One-Time User Email Normalization & Password Hash Audit Script
 *
 * Usage:
 *   node backend/migrate_users.js          (Dry-run mode: checks and reports only)
 *   node backend/migrate_users.js --apply  (Execute mode: safely normalizes unnormalized emails)
 */

const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function auditAndMigrateUsers() {
  const isApply = process.argv.includes("--apply");
  const dbPath = process.env.DB_PATH || path.join(__dirname, "tasks.db");

  console.log(`[User Audit] Opening database at: ${dbPath}`);
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  const users = await db.all("SELECT id, name, email, password, createdAt FROM users");
  console.log(`[User Audit] Total users found in database: ${users.length}`);

  let nonNormalizedEmails = [];
  let invalidHashes = [];
  const seenNormalized = new Map();

  for (const user of users) {
    const rawEmail = user.email || "";
    const cleanEmail = rawEmail.trim().toLowerCase();

    // Check email normalization
    if (rawEmail !== cleanEmail) {
      nonNormalizedEmails.push({
        id: user.id,
        current: rawEmail,
        target: cleanEmail,
      });
    }

    // Check potential duplicate conflict
    if (seenNormalized.has(cleanEmail)) {
      console.warn(
        `[WARNING] Conflict detected: User ID ${user.id} and ID ${seenNormalized.get(
          cleanEmail
        )} normalize to the same email: "${cleanEmail}"`
      );
    } else {
      seenNormalized.set(cleanEmail, user.id);
    }

    // Check bcrypt hash format ($2a$, $2b$, $2y$ + 2 digit cost + 53 char hash = 60 chars)
    const isStandardBcrypt = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password || "");
    if (!isStandardBcrypt) {
      invalidHashes.push({
        id: user.id,
        email: user.email,
        hashPrefix: (user.password || "").substring(0, 10),
        length: (user.password || "").length,
      });
    }
  }

  console.log("\n================ AUDIT SUMMARY ================");
  console.log(`Non-normalized emails found: ${nonNormalizedEmails.length}`);
  console.log(`Abnormal or non-bcrypt password hashes found: ${invalidHashes.length}`);

  if (nonNormalizedEmails.length > 0) {
    console.log("\nUsers requiring email normalization:");
    nonNormalizedEmails.forEach((u) => {
      console.log(` - ID ${u.id}: "${u.current}" -> "${u.target}"`);
    });
  } else {
    console.log("✓ All existing user emails are already trimmed and lowercased.");
  }

  if (invalidHashes.length > 0) {
    console.log("\nUsers with abnormal password hashes (require password reset):");
    invalidHashes.forEach((u) => {
      console.log(` - ID ${u.id} (${u.email}): length=${u.length}, prefix=${u.hashPrefix}`);
    });
  } else {
    console.log("✓ All user password hashes are standard 60-character bcrypt hashes.");
  }

  if (!isApply) {
    console.log("\n[DRY RUN COMPLETE] No modifications were made. Pass --apply to execute.");
    await db.close();
    return;
  }

  if (nonNormalizedEmails.length > 0) {
    console.log("\n[APPLYING MIGRATION] Updating non-normalized emails...");
    await db.run("BEGIN TRANSACTION");
    try {
      for (const item of nonNormalizedEmails) {
        await db.run("UPDATE users SET email = ? WHERE id = ?", item.target, item.id);
        console.log(`  Updated user ID ${item.id} to "${item.target}"`);
      }
      await db.run("COMMIT");
      console.log("✓ Email normalization migration applied successfully.");
    } catch (err) {
      await db.run("ROLLBACK");
      console.error("Migration failed and rolled back:", err.message);
    }
  }

  await db.close();
}

auditAndMigrateUsers().catch((err) => {
  console.error("Migration script error:", err);
  process.exit(1);
});
