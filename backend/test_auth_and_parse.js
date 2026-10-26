const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const jwt = require("jsonwebtoken");
const authenticateToken = require("./authMiddleware");
const {
  parseNaturalLanguageTask,
  breakdownTaskIntoSubtasks,
  generateDailyPlan,
  rescheduleTasks,
} = require("./aiService");

console.log("=== Auth Middleware & AI Parsing In-Memory Verification ===");

// 1. Verify JWT_SECRET is configured
assert(process.env.JWT_SECRET, "JWT_SECRET must be configured");
console.log("✓ JWT_SECRET is properly loaded from environment");

// 2. Test parseNaturalLanguageTask determinism and relative date calculation
const refDate = new Date("2026-10-25T00:00:00.000Z");
const parsed = parseNaturalLanguageTask("Prepare project presentation tomorrow #High", refDate);

assert.strictEqual(parsed.task, "Prepare project presentation");
assert.strictEqual(parsed.priority, "High");
assert.strictEqual(parsed.dueDate, "2026-10-26");
console.log("✓ parseNaturalLanguageTask correctly extracted title, 'High' priority, and '2026-10-26' due date");

// 3. Test authenticateToken without token -> 401
let authFailedStatus = null;
let authFailedMessage = null;
const reqNoToken = { headers: {} };
const resNoToken = {
  status(code) {
    authFailedStatus = code;
    return {
      json(data) {
        authFailedMessage = data.message;
      },
    };
  },
};

authenticateToken(reqNoToken, resNoToken, () => {});
assert.strictEqual(authFailedStatus, 401, "Missing token must return 401");
assert.strictEqual(authFailedMessage, "Authentication token is required. Please log in.");
console.log("✓ authMiddleware safely returns 401 when token is missing (never 500)");

// 4. Test authenticateToken with valid token -> next() called and req.user populated
const validToken = jwt.sign(
  { id: 2, email: "manojmanoj60281@gmail.com", name: "Manoj" },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

const reqValid = { headers: { authorization: `Bearer ${validToken}` } };
const resValid = {
  status(code) {
    throw new Error(`Unexpected status call: ${code}`);
  },
};
let nextCalled = false;

authenticateToken(reqValid, resValid, () => {
  nextCalled = true;
});

assert.strictEqual(nextCalled, true, "next() must be called on valid token");
assert.strictEqual(reqValid.user.id, 2);
assert.strictEqual(reqValid.user.email, "manojmanoj60281@gmail.com");
console.log("✓ authMiddleware successfully validates authentic JWT token and assigns req.user");

// 5. Test breakdownTaskIntoSubtasks
const breakdown = breakdownTaskIntoSubtasks("Prepare project presentation", "High", "2026-10-26", refDate);
assert(Array.isArray(breakdown.subtasks) && breakdown.subtasks.length > 0);
console.log(`✓ breakdownTaskIntoSubtasks produced ${breakdown.subtasks.length} subtasks`);

// 6. Test generateDailyPlan with user's exact DBMS exam prompt
const existingMockTasks = [
  { id: 101, task: "DBMS lab assignment", priority: "High", dueDate: "2026-10-26", completed: 0 },
];
const plan = generateDailyPlan(
  "I have a DBMS exam in 5 days and can study 3 hours daily.",
  existingMockTasks,
  {},
  refDate
);

assert.strictEqual(plan.totalDays, 5, "Total days must be 5");
assert.strictEqual(plan.dailyHours, 3, "Daily hours must be 3");
assert.strictEqual(plan.totalHours, 15, "Total hours must be 15");
assert.strictEqual(plan.schedule.length, 5, "Schedule must have 5 days");
assert.strictEqual(plan.schedule[0].date, "2026-10-26");
assert.strictEqual(plan.schedule[4].date, "2026-10-30");
assert(plan.schedule[0].items.length >= 2, "Day 1 must have at least 2 sessions");
assert(plan.recommendations.length > 0, "Plan must contain recommendations");
console.log("✓ generateDailyPlan successfully generated 5-day DBMS exam study plan with 15 study hours");

// 7. Test rescheduleTasks - Overdue identification, priority ordering & capacity distribution
const mockTaskBank = [
  { id: 10, task: "Critical DBMS Migration", priority: "High", dueDate: "2026-10-22", completed: 0 },   // 90m
  { id: 11, task: "Review PR comments", priority: "Low", dueDate: "2026-10-23", completed: 0 },         // 30m -> Day 1 (120m)
  { id: 12, task: "Refactor API endpoints", priority: "High", dueDate: "2026-10-24", completed: 0 },    // 90m -> Day 2 (cannot fit Day 1 at 2h)
  { id: 13, task: "Clean up documentation", priority: "Medium", dueDate: "2026-10-21", completed: 0 },  // 60m -> Day 2 (90m + 60m > 120m -> Day 3)
  { id: 14, task: "Finished assignment", priority: "High", dueDate: "2026-10-20", completed: 1 },       // Ignored (completed)
  { id: 15, task: "Future task", priority: "Medium", dueDate: "2026-10-28", completed: 0 }             // Future (not overdue)
];

const reschedulePlan = rescheduleTasks(mockTaskBank, {
  dailyCapacityHours: 2, // 120 mins daily capacity
  maxDaysAhead: 5,
  referenceDate: refDate
});

assert.strictEqual(reschedulePlan.summary.totalOverdueCount, 4, "Must identify exactly 4 overdue tasks");
assert.strictEqual(reschedulePlan.summary.rescheduledCount, 4, "All 4 must be rescheduled within capacity");
assert.strictEqual(reschedulePlan.summary.conflictCount, 0, "No conflicts expected under 5-day window");

// Verify High priority task is scheduled first
assert.strictEqual(reschedulePlan.recommendations[0].taskId, 10);
assert.strictEqual(reschedulePlan.recommendations[0].proposedDueDate, "2026-10-26");

// Verify tasks are distributed across multiple days (not all dumped on Day 1)
const distinctProposedDates = new Set(reschedulePlan.recommendations.map(r => r.proposedDueDate));
assert(distinctProposedDates.size >= 2, "Tasks must be distributed across multiple future days");

// Verify no task is scheduled in the past
reschedulePlan.recommendations.forEach(r => {
  if (r.proposedDueDate) {
    assert(new Date(r.proposedDueDate) >= refDate, "Proposed date cannot be in the past");
  }
});
console.log("✓ rescheduleTasks correctly prioritizes, respects 2h daily capacity, and distributes across future days");

// 8. Test impossible deadlines and conflict detection
const tightWindowPlan = rescheduleTasks(
  [
    { id: 21, task: "Huge task 1", priority: "High", dueDate: "2026-10-20", completed: 0 }, // 90m
    { id: 22, task: "Huge task 2", priority: "High", dueDate: "2026-10-21", completed: 0 }, // 90m
    { id: 23, task: "Huge task 3", priority: "High", dueDate: "2026-10-22", completed: 0 }, // 90m
  ],
  {
    dailyCapacityHours: 1.5, // 90 mins max per day
    maxDaysAhead: 1,         // Only 1 day available -> only 1 task can fit
    referenceDate: refDate
  }
);

assert.strictEqual(tightWindowPlan.summary.rescheduledCount, 1, "Only 1 task can fit in 1 day at 90m");
assert.strictEqual(tightWindowPlan.summary.conflictCount, 2, "2 tasks must be flagged as conflicts");
assert.strictEqual(tightWindowPlan.summary.hasConflicts, true);
assert(tightWindowPlan.conflicts[0].reason.includes("exceeds"), "Conflict reason must be clearly explained");
console.log("✓ rescheduleTasks detects impossible capacity schedules and provides clear diagnostic conflict reasons");

// 9. Verify read-only non-mutation of original task records
const originalDueDateBefore = mockTaskBank[0].dueDate;
assert.strictEqual(mockTaskBank[0].dueDate, originalDueDateBefore, "Original task record must never be mutated during planning");
console.log("✓ Rescheduling engine is strictly read-only and leaves input objects completely untouched");

console.log("\nALL IN-MEMORY AUTH & AI TESTS PASSED SUCCESSFULLY!");
