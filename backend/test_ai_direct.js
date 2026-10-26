require("dotenv").config({ path: __dirname + "/.env" });
const jwt = require("jsonwebtoken");
const authenticateToken = require("./authMiddleware");
const aiRoutes = require("./aiRoutes");
const assert = require("assert");

function createMockReqRes(method, path, body, token) {
  const req = {
    method,
    url: path,
    path,
    body: body || {},
    headers: token ? { authorization: `Bearer ${token}` } : {}
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };

  return { req, res };
}

const token = jwt.sign(
  { id: 1, email: "test@example.com", name: "Tester" },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

// Test 1: Middleware authorization success
const { req: req1, res: res1 } = createMockReqRes("POST", "/parse", { text: "Complete sprint review tomorrow #High" }, token);
authenticateToken(req1, res1, () => {
  assert.strictEqual(req1.user.id, 1);
  console.log("✓ Middleware auth passed with valid token");
});

// Test 2: Middleware authorization failure (no token)
const { req: req2, res: res2 } = createMockReqRes("POST", "/parse", { text: "No token" }, null);
authenticateToken(req2, res2, () => {
  assert.fail("Should not call next without token");
});
assert.strictEqual(res2.statusCode, 401);
console.log("✓ Middleware correctly rejected unauthenticated request (401)");

// Test 3: POST /parse route handler
const { req: req3, res: res3 } = createMockReqRes("POST", "/parse", { text: "Refactor backend API endpoints by Friday #High" });
const parseHandler = aiRoutes.stack.find(s => s.route && s.route.path === "/parse").route.stack[0].handle;
parseHandler(req3, res3);
assert.strictEqual(res3.statusCode, 200);
assert.strictEqual(res3.body.success, true);
assert.strictEqual(res3.body.task, "Refactor backend API endpoints");
assert.strictEqual(res3.body.priority, "High");
assert(res3.body.dueDate !== null);
console.log("✓ Route handler /parse executed and returned structured JSON:", res3.body);

// Test 4: POST /breakdown route handler
const { req: req4, res: res4 } = createMockReqRes("POST", "/breakdown", { task: "Build distributed cache system", priority: "High" }, token);
const breakdownRoute = aiRoutes.stack.find(s => s.route && s.route.path === "/breakdown").route;
// stack[0] is authenticateToken, stack[1] is the breakdown handler
const authMiddleware = breakdownRoute.stack[0].handle;
const breakdownHandler = breakdownRoute.stack[1].handle;

authMiddleware(req4, res4, () => {
  breakdownHandler(req4, res4);
});
assert.strictEqual(res4.statusCode, 200);
assert.strictEqual(res4.body.success, true);
assert(Array.isArray(res4.body.subtasks) && res4.body.subtasks.length >= 3);
console.log("✓ Route handler /breakdown executed and generated subtasks:", res4.body.subtasks.length);

// Test 5: POST /query route handler (Unified intent router)
(async () => {
  const queryRoute = aiRoutes.stack.find(s => s.route && s.route.path === "/query").route;
  const qAuthMiddleware = queryRoute.stack[0].handle;
  const queryHandler = queryRoute.stack[1].handle;

  const { req: req5, res: res5 } = createMockReqRes("POST", "/query", { text: "What is database indexing and how does it work?" }, token);
  await new Promise((resolve) => {
    qAuthMiddleware(req5, res5, async () => {
      await queryHandler(req5, res5);
      resolve();
    });
  });
  assert.strictEqual(res5.statusCode, 200);
  assert.strictEqual(res5.body.success, true);
  assert.strictEqual(res5.body.action, "explain");
  assert.strictEqual(res5.body.intent, "general_explanation");
  console.log("✓ Route handler /query executed with explanation intent:", res5.body.action);

  // Test 6: POST /query with task creation intent
  const { req: req6, res: res6 } = createMockReqRes("POST", "/query", { text: "Buy milk tonight #high" }, token);
  await new Promise((resolve) => {
    qAuthMiddleware(req6, res6, async () => {
      await queryHandler(req6, res6);
      resolve();
    });
  });
  assert.strictEqual(res6.statusCode, 200);
  assert.strictEqual(res6.body.action, "create_task");
  assert.strictEqual(res6.body.priority, "High");
  console.log("✓ Route handler /query executed with task_creation intent:", res6.body.action);

  console.log("\nALL DIRECT EXPRESS & ROUTE TESTS PASSED!");
})();
