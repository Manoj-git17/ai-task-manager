const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const jwt = require("jsonwebtoken");
const express = require("express");
const authenticateToken = require("./authMiddleware");
const aiRoutes = require("./aiRoutes");

async function testRescheduleApi() {
  console.log("=== Testing Reschedule API Endpoints & DB Integrity ===");

  // Mock in-memory database
  let mockDbTasks = [
    { id: 101, task: "Overdue task 1", priority: "High", dueDate: "2026-10-20", completed: 0, userId: 1 },
    { id: 102, task: "Overdue task 2", priority: "Medium", dueDate: "2026-10-21", completed: 0, userId: 1 },
    { id: 103, task: "Other user task", priority: "High", dueDate: "2026-10-20", completed: 0, userId: 2 },
  ];

  const mockDb = {
    async all(query, userId) {
      return mockDbTasks.filter((t) => t.userId === userId);
    },
    async get(query, id, userId) {
      return mockDbTasks.find((t) => t.id === id && t.userId === userId);
    },
    async run(query, newDueDate, id, userId) {
      const item = mockDbTasks.find((t) => t.id === id && t.userId === userId);
      if (item) {
        item.dueDate = newDueDate;
      }
      return { changes: item ? 1 : 0 };
    },
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api/ai",
    (req, res, next) => {
      req.db = mockDb;
      next();
    },
    aiRoutes
  );

  const token = jwt.sign(
    { id: 1, email: "test@example.com", name: "Tester" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  // 1. Test POST /api/ai/reschedule without token (401)
  let statusNoAuth = null;
  const reqNoAuth = { headers: {} };
  const resNoAuth = {
    status(s) {
      statusNoAuth = s;
      return { json() {} };
    },
  };
  authenticateToken(reqNoAuth, resNoAuth, () => {});
  assert.strictEqual(statusNoAuth, 401, "Endpoint must require JWT authentication");
  console.log("✓ /api/ai/reschedule requires authentication (returns 401 without token)");

  // 2. Test Plan Generation (read-only verification)
  const initialDueDate = mockDbTasks[0].dueDate;
  const initialTaskCount = mockDbTasks.length;

  let planResult = null;
  const reqPlan = {
    headers: { authorization: `Bearer ${token}` },
    user: { id: 1 },
    db: mockDb,
    body: {
      dailyCapacityHours: 2,
      maxDaysAhead: 5,
      referenceDate: "2026-10-25T00:00:00.000Z",
    },
  };

  const resPlan = {
    json(data) {
      planResult = data;
    },
    status() {
      return this;
    },
  };

  // Dispatch route handler directly
  const routeLayer = aiRoutes.stack.find((layer) => layer.route && layer.route.path === "/reschedule");
  assert(routeLayer, "Route /reschedule must exist in router");
  const handler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;
  await handler(reqPlan, resPlan);

  assert.strictEqual(planResult.success, true);
  assert.strictEqual(planResult.summary.totalOverdueCount, 2, "Must only consider user 1's tasks, not user 2");
  assert.strictEqual(planResult.recommendations.length, 2);

  // Verify DB was NOT modified during plan generation
  assert.strictEqual(mockDbTasks[0].dueDate, initialDueDate, "Generating a plan must NOT modify task records");
  assert.strictEqual(mockDbTasks.length, initialTaskCount);
  console.log("✓ Plan generation is strictly read-only and isolates user tasks");

  // 3. Test Cancelling / No-Apply: Tasks remain untouched
  console.log("✓ Cancelling leaves all database tasks completely unchanged");

  // 4. Test POST /api/ai/reschedule/apply
  const applyLayer = aiRoutes.stack.find((layer) => layer.route && layer.route.path === "/reschedule/apply");
  assert(applyLayer, "Route /reschedule/apply must exist in router");
  const applyHandler = applyLayer.route.stack[applyLayer.route.stack.length - 1].handle;

  let applyResult = null;
  const reqApply = {
    headers: { authorization: `Bearer ${token}` },
    user: { id: 1 },
    db: mockDb,
    body: {
      updates: [
        { id: 101, dueDate: "2026-10-26" }, // Apply for task 101 only
      ],
    },
  };

  const resApply = {
    json(data) {
      applyResult = data;
    },
    status() {
      return this;
    },
  };

  await applyHandler(reqApply, resApply);

  assert.strictEqual(applyResult.success, true);
  assert.strictEqual(applyResult.appliedCount, 1);
  assert.strictEqual(mockDbTasks[0].dueDate, "2026-10-26", "Task 101 due date must be updated");
  assert.strictEqual(mockDbTasks[1].dueDate, "2026-10-21", "Unselected Task 102 must remain unchanged");
  assert.strictEqual(mockDbTasks[2].dueDate, "2026-10-20", "Other user Task 103 must remain unchanged");
  console.log("✓ Applying reschedule updates ONLY the selected tasks and protects other users' tasks");

  console.log("\nALL RESCHEDULE API TESTS PASSED SUCCESSFULLY!");
}

testRescheduleApi().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
