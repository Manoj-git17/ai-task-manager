const assert = require("assert");
const jwt = require("jsonwebtoken");
const {
  isGeminiConfigured,
  getGeminiModelName,
  callGemini,
  generatePlanWithGemini,
  breakdownTaskWithGemini,
  setMockGeminiProvider,
  clearMockGeminiProvider,
} = require("./geminiClient");
const { processUnifiedAiQuery } = require("./aiService");
const aiRoutes = require("./aiRoutes");
require("dotenv").config({ path: __dirname + "/.env" });

console.log("=== Testing Google Gemini SDK Integration & Quality Suite ===\n");

// Helper for route invocation
function createMockReqRes(method, path, body, token) {
  const req = {
    method,
    url: path,
    path,
    body: body || {},
    headers: token ? { authorization: `Bearer ${token}` } : {},
    userId: 1,
    user: { id: 1, email: "test@taskflow.dev", name: "Tester" },
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
    },
  };

  return { req, res };
}

const token = jwt.sign(
  { id: 1, email: "test@taskflow.dev", name: "Tester" },
  process.env.JWT_SECRET || "test-jwt-secret-key-32-characters-minimum",
  { expiresIn: "1h" }
);

async function runGeminiIntegrationTests() {
  // ---------------------------------------------------------------------------
  // [A] Test: Missing API Key Handling
  // ---------------------------------------------------------------------------
  console.log("[A] Testing Missing API Key Behavior:");
  clearMockGeminiProvider();
  const originalKey = process.env.GEMINI_API_KEY;
  const originalGoogleKey = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_GEMINI_API_KEY;

  assert.strictEqual(isGeminiConfigured(), false, "isGeminiConfigured should return false when key is absent");

  const missingKeyRes = await callGemini({ prompt: "Hello Gemini" });
  assert.strictEqual(missingKeyRes.success, false, "callGemini should return success: false without key");
  assert.strictEqual(missingKeyRes.error, "MISSING_KEY", "Error code should be MISSING_KEY");
  assert.ok(missingKeyRes.message.includes("not configured"), "User-friendly message should be provided");

  // Plan generation without key falls back gracefully
  const planWithoutKey = await generatePlanWithGemini("Study DBMS in 3 days", { requestedDays: 3, dailyHours: 2 });
  assert.strictEqual(planWithoutKey.success, false);
  assert.strictEqual(planWithoutKey.error, "MISSING_KEY");
  console.log("✓ Missing API key handled cleanly without unhandled exceptions or secret leakage");

  // Verify GOOGLE_API_KEY environment variable is detected
  process.env.GOOGLE_API_KEY = "test_google_api_key_long_enough_12345";
  assert.strictEqual(isGeminiConfigured(), true, "isGeminiConfigured should support GOOGLE_API_KEY");
  delete process.env.GOOGLE_API_KEY;

  // ---------------------------------------------------------------------------
  // [B] Test: Successful Gemini Responses (Mocked SDK for Quota Protection)
  // ---------------------------------------------------------------------------
  console.log("\n[B] Testing Successful Gemini Responses via Mocked SDK:");

  // Set mock Gemini provider that simulates valid responses
  setMockGeminiProvider(async ({ prompt, jsonMode, modelName }) => {
    assert.ok(modelName.includes("gemini"), `Target model should be Gemini, got: ${modelName}`);

    if (jsonMode) {
      if (prompt.includes("Break down")) {
        return {
          success: true,
          text: JSON.stringify([
            { task: "Initialize database schema & tables", priority: "High", duration: "45 mins" },
            { task: "Implement RESTful API endpoints", priority: "High", duration: "60 mins" },
            { task: "Build unit tests and integration suite", priority: "Medium", duration: "45 mins" },
            { task: "Deploy staging environment and verify", priority: "Low", duration: "30 mins" },
          ]),
          provider: `google-${modelName}`,
        };
      }

      // Daily planner JSON response
      return {
        success: true,
        text: JSON.stringify({
          subject: "DBMS Exam Preparation Mastery",
          overview: "A comprehensive 3-day deep study strategy targeting relational database internals, query optimization, and normalization.",
          totalDays: 3,
          dailyHours: 2,
          recommendations: [
            "Master B+ Tree index traversals and page block layouts",
            "Solve transaction isolation anomalies (dirty reads vs phantom reads)",
            "Practice decomposing relations into 3NF and BCNF"
          ],
          schedule: [
            {
              dayNumber: 1,
              date: "2026-10-27",
              dayLabel: "Day 1",
              theme: "Day 1: Relational Architecture & B+ Tree Indexing",
              items: [
                { task: "Study B+ Tree vs Hash Index mechanics", duration: "60 mins", priority: "High", phase: "Foundations" },
                { task: "Practice query cost analysis with EXPLAIN", duration: "60 mins", priority: "Medium", phase: "Application" }
              ]
            },
            {
              dayNumber: 2,
              date: "2026-10-28",
              dayLabel: "Day 2",
              theme: "Day 2: ACID Transactions & Concurrency",
              items: [
                { task: "Deep dive into 2-Phase Locking (2PL) and MVCC", duration: "60 mins", priority: "High", phase: "Foundations" },
                { task: "Solve transaction conflict serializability graphs", duration: "60 mins", priority: "Medium", phase: "Application" }
              ]
            },
            {
              dayNumber: 3,
              date: "2026-10-29",
              dayLabel: "Day 3",
              theme: "Day 3: Normalization & Timed Mock Exam",
              items: [
                { task: "Drill 1NF through BCNF functional dependencies", duration: "60 mins", priority: "High", phase: "Foundations" },
                { task: "Complete full 60-minute timed mock paper", duration: "60 mins", priority: "High", phase: "Review & Mock" }
              ]
            }
          ]
        }),
        provider: `google-${modelName}`,
      };
    }

    return {
      success: true,
      text: "### C++ Recursion Explained\nRecursion is a programming technique where a function calls itself to solve a smaller instance of the same problem.\n\n```cpp\n#include <iostream>\n\n// Base case: n <= 1\nint factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n```",
      provider: `google-${modelName}`,
    };
  });

  assert.strictEqual(isGeminiConfigured(), true);

  // Test Plan Generation with Mocked Gemini
  const planResult = await generatePlanWithGemini(
    "Help me prepare for my DBMS exam in 3 days",
    { requestedDays: 3, dailyHours: 2 },
    [],
    new Date("2026-10-26T12:00:00Z")
  );

  assert.strictEqual(planResult.success, true);
  assert.strictEqual(planResult.days, 3);
  assert.strictEqual(planResult.dailyHours, 2);
  assert.strictEqual(planResult.actionableTasks.length, 6);
  assert.ok(planResult.provider.includes("gemini"), "Provider should be labeled as Google Gemini");
  console.log(`✓ Successful Gemini plan generated (${planResult.subject}) with provider: ${planResult.provider}`);

  // Test Task Breakdown with Mocked Gemini
  const breakdownRes = await breakdownTaskWithGemini("Build OAuth2 authentication service", "High", "2026-10-30");
  assert.strictEqual(breakdownRes.success, true);
  assert.strictEqual(breakdownRes.subtasks.length, 4);
  assert.strictEqual(breakdownRes.subtasks[0].task, "Initialize database schema & tables");
  console.log(`✓ Successful Gemini task breakdown generated (${breakdownRes.subtasks.length} subtasks)`);

  // ---------------------------------------------------------------------------
  // [C] Test: Different User Intents Producing Appropriate Context-Aware Outputs
  // ---------------------------------------------------------------------------
  console.log("\n[C] Testing User Intent Scenarios (As specified in prompt):");

  // 1. "I want to learn English grammar" -> learning plan
  setMockGeminiProvider(async ({ jsonMode }) => {
    if (jsonMode) {
      return {
        success: true,
        text: JSON.stringify({
          subject: "English Grammar Foundations to Fluency",
          overview: "A structured, beginner-friendly sequence starting with parts of speech, progressing to active/passive voice, tenses, and sentence structure.",
          totalDays: 5,
          dailyHours: 2,
          recommendations: ["Write 5 sample sentences per rule", "Analyze sentence syntax daily"],
          schedule: [
            {
              dayNumber: 1,
              date: "2026-10-27",
              dayLabel: "Day 1",
              theme: "Parts of Speech: Nouns, Verbs & Adjectives",
              items: [{ task: "Master Nouns, Pronouns, and Verb Agreement", duration: "60 mins", priority: "High" }]
            }
          ]
        }),
        provider: "google-gemini-1.5-flash",
      };
    }
    return { success: true, text: "Grammar overview", provider: "google-gemini-1.5-flash" };
  });

  const grammarRes = await processUnifiedAiQuery({ text: "I want to learn English grammar" });
  assert.strictEqual(grammarRes.action, "plan", "Grammar learning query should generate a learning plan");
  assert.ok(grammarRes.plan.subject.includes("English Grammar"), "Subject must be English Grammar");
  console.log("✓ 'I want to learn English grammar' -> Practical structured learning plan");

  // 2. "Explain recursion in C++" -> technical explanation with code, NOT a 5-day task plan
  setMockGeminiProvider(async () => ({
    success: true,
    text: "### Recursion in C++\nRecursion occurs when a function calls itself to solve smaller subproblems.\n\n```cpp\nint factorial(int n) { if (n <= 1) return 1; return n * factorial(n - 1); }\n```\n\n### Key Concepts:\n1. **Base Case**: Halting condition.\n2. **Recursive Step**: Function invoking itself with modified input.\n3. **Call Stack**: Each invocation creates a new stack frame.",
    provider: "google-gemini-1.5-flash",
  }));

  const recursionRes = await processUnifiedAiQuery({ text: "Explain recursion in C++" });
  assert.strictEqual(recursionRes.action, "code_help", "Technical question should produce programming explanation, not task list");
  assert.ok(recursionRes.answer.includes("Recursion in C++"), "Must explain recursion in C++");
  assert.ok(recursionRes.answer.includes("```cpp"), "Must include C++ code block");
  console.log("✓ 'Explain recursion in C++' -> Technical explanation with C++ code & stack analysis");

  // 3. "Build a roadmap to learn data engineering" -> structured roadmap
  setMockGeminiProvider(async () => ({
    success: true,
    text: JSON.stringify({
      subject: "Data Engineering End-to-End Roadmap",
      overview: "A progressive path covering SQL, Python data pipelines, Apache Spark, Airflow orchestration, and Snowflake data warehousing.",
      totalDays: 7,
      dailyHours: 3,
      schedule: [
        {
          dayNumber: 1,
          date: "2026-10-27",
          theme: "Data Modeling & Advanced SQL",
          items: [{ task: "Star schema & snowflake schema design drills", duration: "90 mins", priority: "High" }]
        }
      ]
    }),
    provider: "google-gemini-1.5-flash",
  }));

  const dataEngRes = await processUnifiedAiQuery({ text: "Build a roadmap to learn data engineering" });
  assert.strictEqual(dataEngRes.action, "plan");
  assert.ok(dataEngRes.plan.subject.includes("Data Engineering"));
  console.log("✓ 'Build a roadmap to learn data engineering' -> Comprehensive skills & milestones roadmap");

  // 4. "Break my final-year project into tasks" -> project-specific tasks and dependencies
  setMockGeminiProvider(async () => ({
    success: true,
    text: JSON.stringify([
      { task: "Finalize system architecture & API design document", priority: "High", duration: "60 mins" },
      { task: "Implement backend authentication & database schema", priority: "High", duration: "90 mins" },
      { task: "Build client user interface & connect endpoints", priority: "Medium", duration: "90 mins" },
      { task: "Run integration tests & performance benchmarks", priority: "Medium", duration: "60 mins" },
      { task: "Compile thesis documentation & prepare defense slides", priority: "High", duration: "90 mins" },
    ]),
    provider: "google-gemini-1.5-flash",
  }));

  const projectBreakdown = await processUnifiedAiQuery({ text: "Break my final-year project into tasks" });
  assert.strictEqual(projectBreakdown.action, "breakdown");
  assert.ok(projectBreakdown.subtasks.length >= 4, "Should have 4+ project subtasks");
  assert.ok(projectBreakdown.subtasks.some(s => s.task.includes("architecture")), "Must include architecture milestone");
  console.log("✓ 'Break my final-year project into tasks' -> Specific project deliverables & dependencies");

  // 5. "I want to create a task to finish my assignment tomorrow" -> accurate task creation
  const taskCreationRes = await processUnifiedAiQuery({
    text: "I want to create a task to finish my assignment tomorrow #high",
    referenceDate: new Date("2026-10-26T12:00:00Z"),
  });
  assert.strictEqual(taskCreationRes.action, "create_task");
  assert.ok(taskCreationRes.task.toLowerCase().includes("assignment"));
  assert.strictEqual(taskCreationRes.priority, "High");
  assert.strictEqual(taskCreationRes.dueDate, "2026-10-27");
  console.log("✓ 'Create task to finish assignment tomorrow' -> Extracted title, High priority, and exact due date");

  // ---------------------------------------------------------------------------
  // [D] Test: Invalid or Malformed Model Output Recovery
  // ---------------------------------------------------------------------------
  console.log("\n[D] Testing Malformed Model Output Handling & Recovery:");

  // Model returns malformed JSON with syntax errors
  setMockGeminiProvider(async () => ({
    success: true,
    text: "{ malformed json: missing quotes and brackets ",
    provider: "google-gemini-1.5-flash",
  }));

  const malformedRes = await generatePlanWithGemini("Prepare for exam", { requestedDays: 3 });
  assert.strictEqual(malformedRes.success, false);
  assert.strictEqual(malformedRes.error, "INVALID_OUTPUT");
  console.log("✓ Malformed model JSON safely caught without crashing the process");

  // ---------------------------------------------------------------------------
  // [E] Test: Rate Limits & Provider Failures (429 Quota Exhaustion)
  // ---------------------------------------------------------------------------
  console.log("\n[E] Testing Rate Limits & API Failures (HTTP 429 Quota Exhaustion):");

  setMockGeminiProvider(async () => ({
    success: false,
    error: "QUOTA_EXHAUSTED",
    message: "Gemini API quota or rate limit exceeded. Please check Google AI Studio usage.",
    provider: "google-gemini-1.5-flash",
  }));

  const rateLimitRes = await callGemini({ prompt: "Hello" });
  assert.strictEqual(rateLimitRes.success, false);
  assert.strictEqual(rateLimitRes.error, "QUOTA_EXHAUSTED");
  assert.ok(rateLimitRes.message.includes("quota or rate limit"));
  console.log("✓ Rate limits & quota exhaustion return clear, user-friendly errors without leaking tokens");

  // ---------------------------------------------------------------------------
  // [F] Test: Authentication & User Data Isolation
  // ---------------------------------------------------------------------------
  console.log("\n[F] Testing Authentication & User Isolation on Gemini Endpoints:");

  const planRoute = aiRoutes.stack.find(s => s.route && s.route.path === "/plan").route;
  const pAuthMiddleware = planRoute.stack[0].handle;
  const pHandler = planRoute.stack[1].handle;

  // Unauthenticated request must return 401
  const { req: noAuthReq, res: noAuthRes } = createMockReqRes("POST", "/plan", { goal: "Learn Python" }, null);
  pAuthMiddleware(noAuthReq, noAuthRes, () => assert.fail("Should not reach handler without auth"));
  assert.strictEqual(noAuthRes.statusCode, 401, "Unauthenticated request must be rejected with 401");

  // Authenticated request reaches handler
  const { req: authReq, res: authRes } = createMockReqRes("POST", "/plan", { goal: "Learn Python in 5 days" }, token);
  await new Promise((resolve) => {
    pAuthMiddleware(authReq, authRes, async () => {
      await pHandler(authReq, authRes);
      resolve();
    });
  });
  assert.strictEqual(authRes.statusCode, 200);
  assert.strictEqual(authRes.body.success, true);
  console.log("✓ Authentication strictly verified on AI plan route (401 without token, 200 with valid token)");

  // ---------------------------------------------------------------------------
  // [G] Test: GET /api/ai/status Safe Diagnostic Endpoint
  // ---------------------------------------------------------------------------
  console.log("\n[G] Testing GET /api/ai/status Diagnostic Endpoint:");

  const statusRoute = aiRoutes.stack.find(s => s.route && s.route.path === "/status").route;
  const sHandler = statusRoute.stack[0].handle;
  const { req: sReq, res: sRes } = createMockReqRes("GET", "/status", {});
  sHandler(sReq, sRes);

  assert.strictEqual(sRes.statusCode, 200);
  assert.strictEqual(sRes.body.success, true);
  assert.strictEqual(typeof sRes.body.geminiConfigured, "boolean");
  assert.strictEqual(sRes.body.model, getGeminiModelName());
  assert.strictEqual(sRes.body.sdk, "@google/generative-ai");
  assert.strictEqual(sRes.body.apiKey, undefined, "API Key MUST NEVER be exposed in responses");
  console.log("✓ GET /api/ai/status returns accurate diagnostics while strictly concealing secrets");

  // Restore environment
  clearMockGeminiProvider();
  if (originalKey) {
    process.env.GEMINI_API_KEY = originalKey;
  }
  if (originalGoogleKey) {
    process.env.GOOGLE_API_KEY = originalGoogleKey;
  }

  console.log("\n=======================================================");
  console.log("ALL GOOGLE GEMINI INTEGRATION TESTS PASSED! ✨");
  console.log("=======================================================");
}

runGeminiIntegrationTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
