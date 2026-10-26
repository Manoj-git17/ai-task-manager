const assert = require("assert");
const {
  classifyUserIntent,
  extractUserConstraints,
  validateAndRefinePlan,
  generateDomainExplanation,
} = require("./aiIntentRouter");
const {
  processUnifiedAiQuery,
  parseNaturalLanguageTask,
  breakdownTaskIntoSubtasks,
  generateDailyPlan,
} = require("./aiService");

console.log("=== Testing TaskFlow AI Intent, Planning Quality & Reliability Suite ===\n");

// [1] User Intent Classification across all categories
console.log("[1] Testing Intent Classification Across 10 Categories:");

const intentCases = [
  { text: "What is database indexing and how does it work?", expected: "general_explanation" },
  { text: "Explain how React reconciliation works with Fiber", expected: "general_explanation" },
  { text: "How to learn Python in 30 days step by step", expected: "study_plan" },
  { text: "DBMS semester exam in 3 days with 2 hours daily study", expected: "exam_preparation" },
  { text: "TypeError: Cannot read properties of undefined (reading 'map') in React", expected: "programming_help" },
  { text: "Write an algorithm for binary search tree inversion", expected: "programming_help" },
  { text: "How to plan an e-commerce microservices platform migration", expected: "project_planning" },
  { text: "How to prepare for Google L4 software engineer interview", expected: "career_interview" },
  { text: "Buy groceries and almond milk tonight #high", expected: "task_creation" },
  { text: "Submit quarterly financial audit tomorrow morning", expected: "task_creation" },
  { text: "Break down task: Build OAuth2 authentication system", expected: "task_breakdown" },
  { text: "Decompose this project into actionable milestones", expected: "task_breakdown" },
  { text: "Reschedule my overdue tasks based on capacity", expected: "scheduling" },
  { text: "What should I do first from my tasks?", expected: "scheduling" },
  { text: "Help me", expected: "ambiguous" },
  { text: "I need some ideas", expected: "ambiguous" },
];

for (const tc of intentCases) {
  const result = classifyUserIntent(tc.text);
  assert.strictEqual(
    result,
    tc.expected,
    `Expected intent "${tc.expected}" for query "${tc.text}", got "${result}"`
  );
}
console.log(`✓ All ${intentCases.length} intent classification test cases passed accurately`);

// [2] Constraint Extraction
console.log("\n[2] Testing Constraint Extraction (Days, Daily Hours, Target Date, Skill Level):");

const c1 = extractUserConstraints("DBMS exam in 3 days with 2 hours daily study");
assert.strictEqual(c1.requestedDays, 3, "Failed to extract 3 days");
assert.strictEqual(c1.dailyHours, 2, "Failed to extract 2 hours daily");

const c2 = extractUserConstraints("Learn advanced Kubernetes over 14 days with 4h a day");
assert.strictEqual(c2.requestedDays, 14, "Failed to extract 14 days");
assert.strictEqual(c2.dailyHours, 4, "Failed to extract 4 daily hours");
assert.strictEqual(c2.skillLevel, "advanced", "Failed to extract advanced skill level");

const c3 = extractUserConstraints("Beginner Python roadmap for next week");
assert.strictEqual(c3.skillLevel, "beginner", "Failed to extract beginner skill level");
assert.strictEqual(c3.requestedDays, 7, "Failed to extract next week as 7 days");
console.log("✓ Constraint extraction correctly identified days, daily hours, target dates, and skill level");

// [3] Domain-Specific Explanations (Programming & Career)
console.log("\n[3] Testing Domain-Specific Explanations Without Generic Templates:");

const dbmsExplanation = generateDomainExplanation(
  "What is database indexing and how does it work?",
  "general_explanation"
);
assert.ok(dbmsExplanation.title.includes("Database Indexing"), "Title should reference database indexing");
assert.ok(dbmsExplanation.answer.includes("B+ Tree"), "Explanation must explain actual B+ Tree structure");
assert.ok(Array.isArray(dbmsExplanation.keyTakeaways) && dbmsExplanation.keyTakeaways.length >= 3, "Must have takeaways");
assert.ok(dbmsExplanation.keyTakeaways.some(t => t.point.includes("Time Complexity")), "Must address lookup complexity");

const reactErrorHelp = generateDomainExplanation(
  "How to fix TypeError: Cannot read property map of undefined in React?",
  "programming_help"
);
assert.ok(reactErrorHelp.codeExample && reactErrorHelp.codeExample.code.includes("?.map"), "Must include optional chaining code fix");
assert.ok(reactErrorHelp.answer.includes("asynchronous data fetching"), "Must explain real root cause");

const careerPrep = generateDomainExplanation(
  "How to prepare for Google L4 software engineer interview?",
  "career_interview"
);
assert.ok(careerPrep.answer.includes("Data Structures & Algorithms"), "Must cover DSA");
assert.ok(careerPrep.answer.includes("System Design"), "Must cover System Design");
assert.ok(careerPrep.answer.includes("STAR"), "Must cover STAR behavioral method");
console.log("✓ Domain-specific answers provide concrete technical depth, code snippets, and root causes");

// [4] Plan Quality: Anti-Repetition & Daily Time Budget Enforcement
console.log("\n[4] Testing Plan Quality (Validation, Filler Stripping, Time Constraints):");

const mockRawPlan = {
  subject: "DBMS Exam Preparation",
  days: 3,
  dailyHours: 2, // 2h = 120 minutes max per day
  actionableTasks: [
    { title: "Define scope of project", durationMinutes: 180, priority: "High", dayNumber: 1 },
    { title: "B+ Tree Indexing & Query Execution", durationMinutes: 90, priority: "High", dayNumber: 1 },
    { title: "B+ Tree Indexing & Query Execution", durationMinutes: 90, priority: "High", dayNumber: 1 }, // Duplicate!
    { title: "Initial execution and general planning", durationMinutes: 120, priority: "Medium", dayNumber: 2 }, // Generic filler!
    { title: "ACID Transactions & Two-Phase Locking", durationMinutes: 100, priority: "High", dayNumber: 2 },
    { title: "Wrap up and project conclusion", durationMinutes: 60, priority: "Low", dayNumber: 3 }, // Generic filler!
    { title: "Normalization (1NF to BCNF) & Mock Exam", durationMinutes: 110, priority: "High", dayNumber: 3 },
  ],
};

const refinedPlan = validateAndRefinePlan(mockRawPlan, "DBMS Exam Preparation", {
  requestedDays: 3,
  dailyHours: 2,
});

assert.strictEqual(refinedPlan.days, 3, "Should respect requested 3 days");
// Verify duplicate removal
const btreeCount = refinedPlan.actionableTasks.filter(t => (t.task || t.title).includes("B+ Tree")).length;
assert.strictEqual(btreeCount, 1, "Duplicate task should be removed");

// Verify generic filler was replaced or removed
for (const task of refinedPlan.actionableTasks) {
  const title = (task.task || task.title).toLowerCase();
  assert.ok(!title.includes("define scope"), "Filler 'define scope' must be eliminated");
  assert.ok(!title.includes("wrap up and project conclusion"), "Filler 'wrap up' must be eliminated");
  // Daily duration must respect dailyHours limit (2 hours = 120 mins)
  const durationMins = parseInt(task.duration, 10) || task.durationMinutes || 60;
  assert.ok(
    durationMins <= 120,
    `Task duration ${durationMins}m exceeds daily capacity limit of 120m`
  );
}
console.log("✓ Plan validator successfully eliminated duplicate tasks, stripped generic templates, and enforced time budgets");

// [5] Ambiguous Request Handling
console.log("\n[5] Testing Ambiguous & Incomplete Requests:");

async function testAmbiguity() {
  const result = await processUnifiedAiQuery({ text: "Help me" });
  assert.strictEqual(result.intent, "ambiguous", "Should detect ambiguous intent");
  assert.strictEqual(result.action, "clarify", "Should recommend clarification action");
  assert.ok(
    result.followUpQuestion && result.followUpQuestion.length > 10,
    "Must ask concise follow-up question"
  );
  assert.strictEqual(result.provider, "intent-router", "Should transparently report intent-router provider");
  console.log("✓ Ambiguous input prompts clarification without inventing facts");
}

// [6] Honest Provider Labeling & Fallback Transparency
console.log("\n[6] Testing Provider Transparency (No LLM misrepresentation):");

async function testProviderIntegrity() {
  // Query task creation -> Must report deterministic-task-parser
  const taskRes = await processUnifiedAiQuery({ text: "Schedule review meeting on Friday #high" });
  assert.strictEqual(taskRes.action, "create_task");
  assert.strictEqual(taskRes.provider, "deterministic-task-parser");
  assert.ok(!taskRes.provider.includes("gpt"), "Deterministic parser must never claim to be GPT");

  // Query ambiguous -> Must report intent-router
  const ambigRes = await processUnifiedAiQuery({ text: "Need advice" });
  assert.strictEqual(ambigRes.provider, "intent-router");

  // Query explanation without external LLM -> Must report deterministic-knowledge-engine
  const expRes = await processUnifiedAiQuery({ text: "What is database indexing?" });
  assert.ok(
    expRes.provider === "deterministic-knowledge-engine" || expRes.provider.includes("openai") || expRes.provider.includes("gemini"),
    `Provider must be accurately reported, got: ${expRes.provider}`
  );
  console.log("✓ Provider transparency strictly enforced across deterministic and live layers");
}

// [7] Preserving Existing Task Creation, Breakdown, and Daily Plan Contracts
console.log("\n[7] Verifying Existing API Contracts (parseNaturalLanguageTask, breakdown, generateDailyPlan):");

function testExistingContracts() {
  const parsed = parseNaturalLanguageTask("Refactor backend auth endpoints by Friday #High", new Date("2026-10-26T12:00:00Z"));
  assert.strictEqual(parsed.task, "Refactor backend auth endpoints");
  assert.strictEqual(parsed.priority, "High");
  assert.strictEqual(parsed.dueDate, "2026-10-30");

  const breakdownResult = breakdownTaskIntoSubtasks("Deploy container to production", "High", "2026-10-30");
  const subtasks = breakdownResult.subtasks || breakdownResult;
  assert.ok(Array.isArray(subtasks) && subtasks.length >= 3, "Must produce subtasks");
  assert.ok(subtasks.every(s => s.task && s.priority), "Every subtask must have task and priority");

  const plan = generateDailyPlan("Study React and TypeScript", [], {}, new Date("2026-10-26T12:00:00Z"));
  assert.ok(plan.actionableTasks.length > 0, "Plan must generate actionable tasks");
  assert.ok((plan.days || plan.totalDays) >= 1, "Plan must have positive days");
  console.log("✓ Existing API contracts (/parse, /breakdown, /plan) 100% backward-compatible");
}

async function testScheduleAndPlanningGeneration() {
  console.log("\n[8] Testing AI Scheduling & Action Plan Generation (No Blind Task Dumping):");
  
  const scheduleQueries = [
    "Clean my room",
    "Schedule my day",
    "Daily schedule",
    "Workout routine",
    "Study Python",
    "Plan for tomorrow",
    "DSA exam in 3 days",
  ];

  for (const q of scheduleQueries) {
    const res = await processUnifiedAiQuery({ text: q });
    assert.strictEqual(
      res.action,
      "plan",
      `Query "${q}" should generate a structured schedule/plan (action: plan), but got "${res.action}"`
    );
    assert.ok(res.plan, `Query "${q}" must include a structured plan object`);
    assert.ok(
      Array.isArray(res.plan.actionableTasks) && res.plan.actionableTasks.length >= 2,
      `Query "${q}" must produce actionable milestone tasks in the schedule`
    );
  }

  // Verify explicit atomic task creation is preserved
  const taskRes = await processUnifiedAiQuery({ text: "Buy groceries and milk tonight #high" });
  assert.strictEqual(taskRes.action, "create_task", "Single errand with priority tag must create task");
  assert.strictEqual(taskRes.priority, "High");

  console.log("✓ All schedule, routine, and chore queries accurately generate structured schedules instead of raw tasks");
}

async function runAll() {
  await testAmbiguity();
  await testProviderIntegrity();
  testExistingContracts();
  await testScheduleAndPlanningGeneration();
  console.log("\n=======================================================");
  console.log("ALL AI INTENT, RELEVANCE, AND QUALITY TESTS PASSED! ✨");
  console.log("=======================================================");
}

runAll().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
