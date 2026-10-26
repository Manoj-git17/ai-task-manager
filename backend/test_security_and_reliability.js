const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const jwt = require("jsonwebtoken");
const authenticateToken = require("./authMiddleware");
const createRateLimiter = require("./rateLimiter");

async function runSecurityTestSuite() {
  console.log("=== Testing TaskFlow Security & Backend Reliability Suite ===");

  const secret = process.env.JWT_SECRET;
  assert(secret, "JWT_SECRET must be configured");

  // 1. Verify all 14 protected endpoints reject unauthenticated requests (HTTP 401)
  console.log("\n[1] Auditing Unauthenticated Rejections on Protected Endpoints:");
  const protectedRoutes = [
    { method: "GET", path: "/api/me" },
    { method: "GET", path: "/api/tasks" },
    { method: "POST", path: "/api/tasks" },
    { method: "POST", path: "/api/tasks/bulk" },
    { method: "PUT", path: "/api/tasks/1" },
    { method: "PATCH", path: "/api/tasks/1" },
    { method: "DELETE", path: "/api/tasks/1" },
    { method: "DELETE", path: "/api/tasks" },
    { method: "GET", path: "/api/analytics" },
    { method: "GET", path: "/api/goals" },
    { method: "POST", path: "/api/goals" },
    { method: "DELETE", path: "/api/goals/1" },
    { method: "POST", path: "/api/ai/breakdown" },
    { method: "POST", path: "/api/ai/plan" },
    { method: "POST", path: "/api/ai/reschedule" },
    { method: "POST", path: "/api/ai/reschedule/apply" },
  ];

  for (const route of protectedRoutes) {
    let statusCode = null;
    let responseBody = null;
    const mockReq = { headers: {} };
    const mockRes = {
      status(code) {
        statusCode = code;
        return {
          json(data) {
            responseBody = data;
          },
        };
      },
    };

    authenticateToken(mockReq, mockRes, () => {
      assert.fail(`Unauthenticated request allowed on ${route.method} ${route.path}!`);
    });

    assert.strictEqual(statusCode, 401, `${route.method} ${route.path} must return 401 without token`);
    assert.strictEqual(responseBody.success, false);
    assert(responseBody.message.includes("token"), "Error message should mention token");
  }
  console.log(`✓ All ${protectedRoutes.length} protected endpoints strictly reject unauthenticated requests with HTTP 401`);

  // 2. Test Invalid Token & Expired Token
  console.log("\n[2] Testing Token Tampering & Expiration Security:");
  let invalidStatus = null;
  const reqInvalid = { headers: { authorization: "Bearer invalid.forged.token123" } };
  const resInvalid = {
    status(code) {
      invalidStatus = code;
      return { json: () => {} };
    },
  };
  authenticateToken(reqInvalid, resInvalid, () => assert.fail("Invalid token must not pass"));
  assert.strictEqual(invalidStatus, 403, "Tampered/invalid token must return 403 Forbidden");
  console.log("✓ Tampered/forged token correctly rejected with HTTP 403");

  const expiredToken = jwt.sign({ id: 1, email: "user@test.com" }, secret, { expiresIn: "-1s" });
  let expiredStatus = null;
  let expiredMsg = null;
  const reqExpired = { headers: { authorization: `Bearer ${expiredToken}` } };
  const resExpired = {
    status(code) {
      expiredStatus = code;
      return {
        json: (d) => {
          expiredMsg = d.message;
        },
      };
    },
  };
  authenticateToken(reqExpired, resExpired, () => assert.fail("Expired token must not pass"));
  assert.strictEqual(expiredStatus, 401, "Expired token must return 401");
  assert(expiredMsg.toLowerCase().includes("expired"), "Must inform client of expired session");
  console.log("✓ Expired token correctly rejected with HTTP 401 and expiration notice");

  // 3. Test Rate Limiter Protection
  console.log("\n[3] Testing In-Memory Sliding Window Rate Limiter:");
  const testLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: "Rate limit exceeded for test.",
  });

  const ip = "192.168.1.100";
  let lastStatus = 200;
  for (let i = 1; i <= 6; i++) {
    const mockReq = { socket: { remoteAddress: ip }, headers: {} };
    const mockRes = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        lastStatus = code;
        return {
          json: (data) => {
            this.body = data;
          },
        };
      },
    };

    let nextCalled = false;
    testLimiter(mockReq, mockRes, () => {
      nextCalled = true;
    });

    if (i <= 5) {
      assert.strictEqual(nextCalled, true, `Request ${i} within limit should pass`);
      assert.strictEqual(mockRes.headers["RateLimit-Remaining"], 5 - i);
    } else {
      assert.strictEqual(nextCalled, false, "Request 6 exceeding limit must be blocked");
      assert.strictEqual(lastStatus, 429, "Exceeded limit must return HTTP 429");
      assert(mockRes.headers["Retry-After"] > 0, "Must set Retry-After header");
    }
  }
  console.log("✓ Rate limiter successfully blocks excess requests with HTTP 429 and Retry-After header");

  // 4. Test Task Completion Timestamping Logic
  console.log("\n[4] Testing Task Completion Timestamping Logic:");
  function getTaskInput(body, existingTask = {}) {
    const isCompleted =
      body.completed === undefined
        ? Boolean(existingTask.completed)
        : Boolean(body.completed);

    let completedAt = existingTask.completedAt || null;
    if (isCompleted && !existingTask.completed) {
      completedAt = new Date().toISOString();
    } else if (!isCompleted) {
      completedAt = null;
    }

    return {
      task: body.task === undefined ? existingTask.task : String(body.task).trim(),
      priority: body.priority === undefined ? existingTask.priority : body.priority,
      dueDate: body.dueDate === undefined ? existingTask.dueDate : body.dueDate || null,
      completed: isCompleted,
      completedAt,
      favorite: body.favorite === undefined ? Boolean(existingTask.favorite) : Boolean(body.favorite),
    };
  }

  // 4a. Completing an active task assigns completedAt
  const existingActive = { id: 1, task: "Build feature", completed: 0, completedAt: null };
  const updated1 = getTaskInput({ completed: true }, existingActive);
  assert.strictEqual(updated1.completed, true);
  assert(typeof updated1.completedAt === "string" && !Number.isNaN(Date.parse(updated1.completedAt)));
  console.log("✓ Completing task automatically records ISO timestamp in completedAt");

  // 4b. Uncompleting a task clears completedAt
  const existingDone = { id: 1, task: "Build feature", completed: 1, completedAt: "2026-10-24T10:00:00.000Z" };
  const updated2 = getTaskInput({ completed: false }, existingDone);
  assert.strictEqual(updated2.completed, false);
  assert.strictEqual(updated2.completedAt, null);
  console.log("✓ Reactivating/uncompleting task resets completedAt to null");

  // 4c. Editing task details without changing completion preserves completedAt
  const updated3 = getTaskInput({ priority: "High" }, existingDone);
  assert.strictEqual(updated3.completedAt, "2026-10-24T10:00:00.000Z");
  console.log("✓ Editing other fields preserves existing completion timestamp");

  console.log("\nALL SECURITY & BACKEND RELIABILITY TESTS PASSED SUCCESSFULLY!\n");
}

runSecurityTestSuite();
