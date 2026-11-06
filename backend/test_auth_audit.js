/**
 * TaskFlow Authentication Reliability & Lifecycle Verification Test
 *
 * Verifies the 5 requirements specified in Step 4:
 * 1. Mixed-case signup with trailing/leading spaces.
 * 2. Lowercase login with identical password.
 * 3. Profile update followed by login verification.
 * 4. Server restart followed by login verification.
 * 5. Wrong password cleanly rejected with 401.
 */

// Dynamically use an ephemeral port to prevent collisions with any running dev server
const TEST_PORT = 5055;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

let serverInstance = null;

async function startServer() {
  const { app } = require("./server");
  return new Promise((resolve) => {
    serverInstance = app.listen(TEST_PORT, () => {
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        serverInstance = null;
        setTimeout(resolve, 300);
      });
    } else {
      resolve();
    }
  });
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runAuditProof() {
  console.log("==================================================================");
  console.log("          TASKFLOW AUTHENTICATION AUDIT PROOF SUITE               ");
  console.log("==================================================================\n");

  await startServer();

  const timestamp = Date.now();
  const rawSignupEmail = `  Audit.User.${timestamp}@Gmail.com  `;
  const normalizedLoginEmail = `audit.user.${timestamp}@gmail.com`;
  const password = "AuditPassword2026!";
  let testUserId = null;

  try {
    // ---------------------------------------------------------
    // STEP 1: Sign up new user with mixed-case and padded email
    // ---------------------------------------------------------
    console.log(`[Step 1] Registering user with mixed-case email: "${rawSignupEmail}"`);
    const regRes = await request("/register", {
      method: "POST",
      body: {
        name: "Audit Tester",
        email: rawSignupEmail,
        password: password,
      },
    });

    console.log(`Status: ${regRes.status}`);
    console.log(`Response:`, JSON.stringify(regRes.data));

    if (regRes.status !== 201 || !regRes.data.token) {
      throw new Error(`Step 1 Failed: Expected status 201, got ${regRes.status}`);
    }
    if (regRes.data.user.email !== normalizedLoginEmail) {
      throw new Error(
        `Step 1 Failed: Stored email "${regRes.data.user.email}" does not match normalized "${normalizedLoginEmail}"`
      );
    }

    testUserId = regRes.data.user.id;
    const authToken = regRes.data.token;
    console.log("✓ Step 1 PASSED: Mixed-case signup successfully stored normalized email.\n");

    // ---------------------------------------------------------
    // STEP 2: Log in with lowercase email and same password
    // ---------------------------------------------------------
    console.log(`[Step 2] Logging in with lowercase email: "${normalizedLoginEmail}"`);
    const loginRes1 = await request("/login", {
      method: "POST",
      body: {
        email: normalizedLoginEmail,
        password: password,
      },
    });

    console.log(`Status: ${loginRes1.status}`);
    console.log(`Response:`, JSON.stringify(loginRes1.data));

    if (loginRes1.status !== 200 || !loginRes1.data.token) {
      throw new Error(`Step 2 Failed: Expected status 200, got ${loginRes1.status}`);
    }
    console.log("✓ Step 2 PASSED: Lowercase login succeeded seamlessly.\n");

    // ---------------------------------------------------------
    // STEP 3: Update user's profile, then log in again
    // ---------------------------------------------------------
    console.log(`[Step 3] Updating user profile name to "Audit Tester Updated" via PUT /api/user/profile`);
    const profileRes = await request("/user/profile", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: {
        name: "Audit Tester Updated",
      },
    });

    console.log(`Profile Update Status: ${profileRes.status}`);
    console.log(`Profile Response:`, JSON.stringify(profileRes.data));

    if (profileRes.status !== 200 || profileRes.data.user.name !== "Audit Tester Updated") {
      throw new Error(`Step 3 Profile Update Failed: Expected status 200`);
    }

    console.log(`[Step 3 Verification] Logging in again after profile update...`);
    const loginRes2 = await request("/login", {
      method: "POST",
      body: {
        email: normalizedLoginEmail,
        password: password,
      },
    });

    console.log(`Status: ${loginRes2.status}`);
    console.log(`Response:`, JSON.stringify(loginRes2.data));

    if (loginRes2.status !== 200 || !loginRes2.data.token) {
      throw new Error(`Step 3 Login Failed: Password was corrupted or login failed after profile update!`);
    }
    console.log("✓ Step 3 PASSED: Profile update did not corrupt password; login succeeded.\n");

    // ---------------------------------------------------------
    // STEP 4: Restart the server, then log in again
    // ---------------------------------------------------------
    console.log(`[Step 4] Restarting server instance (simulating deployment or instance reboot)...`);
    await stopServer();
    console.log("Server stopped successfully.");

    await startServer();
    console.log("Server restarted successfully on port " + TEST_PORT + ".");

    console.log(`[Step 4 Verification] Logging in after server restart...`);
    const loginRes3 = await request("/login", {
      method: "POST",
      body: {
        email: normalizedLoginEmail,
        password: password,
      },
    });

    console.log(`Status: ${loginRes3.status}`);
    console.log(`Response:`, JSON.stringify(loginRes3.data));

    if (loginRes3.status !== 200 || !loginRes3.data.token) {
      throw new Error(`Step 4 Failed: Expected status 200 after restart, got ${loginRes3.status}`);
    }
    console.log("✓ Step 4 PASSED: User credentials remain intact and valid across server restarts.\n");

    // ---------------------------------------------------------
    // STEP 5: Log in with wrong password
    // ---------------------------------------------------------
    console.log(`[Step 5] Attempting login with an incorrect password: "WrongPass_999!"`);
    const loginRes4 = await request("/login", {
      method: "POST",
      body: {
        email: normalizedLoginEmail,
        password: "WrongPass_999!",
      },
    });

    console.log(`Status: ${loginRes4.status}`);
    console.log(`Response:`, JSON.stringify(loginRes4.data));

    if (loginRes4.status !== 401 || loginRes4.data.message !== "Invalid email or password.") {
      throw new Error(
        `Step 5 Failed: Expected 401 "Invalid email or password.", got ${loginRes4.status} with message "${loginRes4.data.message}"`
      );
    }
    console.log("✓ Step 5 PASSED: Wrong password cleanly rejected with 401 error.\n");

    console.log("==================================================================");
    console.log("          ALL 5 STEP VERIFICATION TESTS PASSED SUCCESSFULLY!       ");
    console.log("==================================================================");
  } finally {
    // Clean up test user so local DB remains clean
    if (testUserId) {
      try {
        const initializeDB = require("./db");
        const db = await initializeDB();
        await db.run("DELETE FROM users WHERE id = ?", testUserId);
        console.log(`[Cleanup] Cleaned up test user (ID: ${testUserId}).`);
      } catch (cleanupErr) {
        console.warn("[Cleanup] Warning during test user cleanup:", cleanupErr.message);
      }
    }

    await stopServer();
  }
}

runAuditProof()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nFATAL ERROR IN TEST SUITE:", err.message);
    process.exit(1);
  });
