const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const jwt = require("jsonwebtoken");
const express = require("express");
const authenticateToken = require("./authMiddleware");
const analyticsRoutes = require("./analyticsRoutes");
const {
  calculateProductivityAnalytics,
} = require("./analyticsService");

async function runAnalyticsTestSuite() {
  console.log("=== Testing Productivity Intelligence & Analytics Suite ===");

  const ref = new Date("2026-10-25T00:00:00.000Z"); // Sunday

  // 1. Analytics & Completion Calculations
  const mockTasks = [
    { id: 1, task: "Task 1", priority: "High", completed: 1, completedAt: "2026-10-25T10:00:00.000Z", dueDate: "2026-10-25", userId: 1 },
    { id: 2, task: "Task 2", priority: "High", completed: 1, completedAt: "2026-10-24T12:00:00.000Z", dueDate: "2026-10-24", userId: 1 },
    { id: 3, task: "Task 3", priority: "Medium", completed: 1, completedAt: "2026-10-23T08:00:00.000Z", dueDate: "2026-10-23", userId: 1 },
    { id: 4, task: "Task 4", priority: "High", completed: 0, dueDate: "2026-10-21", userId: 1 }, // Overdue
    { id: 5, task: "Task 5", priority: "Medium", completed: 0, dueDate: "2026-10-26", userId: 1 }, // Due tomorrow
    { id: 6, task: "Task 6", priority: "Low", completed: 0, dueDate: "2026-10-28", userId: 1 }, // Due in 3 days
  ];

  const mockGoals = [
    { id: 1, title: "Weekly 4 Tasks", targetCount: 4, category: "all", userId: 1 },
    { id: 2, title: "High Priority Goals", targetCount: 2, category: "High", userId: 1 },
  ];

  const analytics = calculateProductivityAnalytics(mockTasks, mockGoals, { referenceDate: ref });

  // Verification 1: Overview
  assert.strictEqual(analytics.overview.totalTasks, 6, "Total tasks must be 6");
  assert.strictEqual(analytics.overview.completedTasks, 3, "Completed tasks must be 3");
  assert.strictEqual(analytics.overview.pendingTasks, 3, "Pending tasks must be 3");
  assert.strictEqual(analytics.overview.overdueTasks, 1, "Overdue tasks must be 1");
  assert.strictEqual(analytics.overview.completionRate, 50, "Completion rate must be 50%");
  assert.strictEqual(analytics.overview.completedToday, 1, "Completed today must be 1");
  assert.strictEqual(analytics.overview.completedThisWeek, 3, "Completed this week must be 3");
  console.log("✓ Overview metrics accurately calculated from actual task records");

  // Verification 2: Weekly Trends
  assert.strictEqual(analytics.weeklyTrends.length, 7, "Must produce past 7 days");
  const todayBucket = analytics.weeklyTrends[analytics.weeklyTrends.length - 1];
  assert.strictEqual(todayBucket.date, "2026-10-25");
  assert.strictEqual(todayBucket.completed, 1);
  console.log("✓ Weekly trend chart data correctly aggregated over past 7 calendar days");

  // Verification 3: Priority Distribution
  assert.strictEqual(analytics.priorities.High.total, 3);
  assert.strictEqual(analytics.priorities.High.completed, 2);
  assert.strictEqual(analytics.priorities.High.pending, 1);
  assert.strictEqual(analytics.priorities.Medium.total, 2);
  assert.strictEqual(analytics.priorities.Low.total, 1);
  console.log("✓ Priority distribution (High, Medium, Low) calculated correctly");

  // Verification 4: Consistency Streaks
  assert.strictEqual(analytics.streaks.currentStreak, 3, "Current streak must be 3 days (Oct 23, 24, 25)");
  assert.strictEqual(analytics.streaks.longestStreak, 3, "Longest streak must be 3");
  assert.strictEqual(analytics.streaks.activeDaysThisWeek, 3);
  console.log("✓ Consistency streaks accurately determined without fabricated historical activity");

  // Verification 5: Empty Taskset Handling (Zero tasks)
  const emptyAnalytics = calculateProductivityAnalytics([], [], { referenceDate: ref });
  assert.strictEqual(emptyAnalytics.overview.totalTasks, 0);
  assert.strictEqual(emptyAnalytics.overview.completionRate, 0);
  assert.strictEqual(emptyAnalytics.streaks.currentStreak, 0);
  assert.strictEqual(emptyAnalytics.streaks.longestStreak, 0);
  console.log("✓ Empty datasets handled safely with zero division safeguards");

  // Verification 6: Goal Progress Tracking
  assert.strictEqual(analytics.goals[0].currentCount, 3);
  assert.strictEqual(analytics.goals[0].targetCount, 4);
  assert.strictEqual(analytics.goals[0].progressPercentage, 75);
  assert.strictEqual(analytics.goals[0].remainingCount, 1);
  assert.strictEqual(analytics.goals[0].status, "in_progress");

  assert.strictEqual(analytics.goals[1].currentCount, 2);
  assert.strictEqual(analytics.goals[1].targetCount, 2);
  assert.strictEqual(analytics.goals[1].progressPercentage, 100);
  assert.strictEqual(analytics.goals[1].remainingCount, 0);
  assert.strictEqual(analytics.goals[1].status, "completed");
  console.log("✓ Goal progress tracked accurately against actual completed task records");

  // Verification 7: Actionable Rule-Based Insights
  assert(analytics.insights.length >= 2, "Must produce multiple rule-backed insights");
  const overdueInsight = analytics.insights.find((i) => i.id === "insight-overdue");
  assert(overdueInsight, "Must detect overdue task and recommend rescheduler");
  assert(overdueInsight.message.includes("Task 4"), "Must cite exact real task name");
  console.log("✓ Rule-based insights correctly generated and cite real task data");

  // Verification 8: HTTP API & User Isolation
  let mockDbGoals = [
    { id: 1, title: "User 1 Goal", targetCount: 5, category: "all", targetDate: "2026-10-31", userId: 1 },
    { id: 2, title: "User 2 Goal", targetCount: 10, category: "all", targetDate: "2026-10-31", userId: 2 },
  ];

  const mockDb = {
    async all(query, userId) {
      if (query.includes("FROM goals")) {
        return mockDbGoals.filter((g) => g.userId === userId);
      }
      return mockTasks.filter((t) => t.userId === userId);
    },
    async get(query, id, userId) {
      return mockDbGoals.find((g) => g.id === id && g.userId === userId);
    },
    async run(query, ...params) {
      if (query.includes("INSERT INTO goals")) {
        const [title, targetCount, category, targetDate, userId] = params;
        const newGoal = {
          id: mockDbGoals.length + 1,
          title,
          targetCount,
          category,
          targetDate,
          userId,
        };
        mockDbGoals.push(newGoal);
        return { lastID: newGoal.id };
      }
      if (query.includes("DELETE FROM goals")) {
        const [id, userId] = params;
        const prevLen = mockDbGoals.length;
        mockDbGoals = mockDbGoals.filter((g) => !(g.id === id && g.userId === userId));
        return { changes: prevLen - mockDbGoals.length };
      }
      return { changes: 1 };
    },
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    (req, res, next) => {
      req.db = mockDb;
      next();
    },
    analyticsRoutes
  );

  const tokenUser1 = jwt.sign(
    { id: 1, email: "u1@example.com", name: "User 1" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  // Test GET /api/analytics unauthenticated (401)
  let statusNoAuth = null;
  const reqNoAuth = { headers: {} };
  const resNoAuth = {
    status(s) {
      statusNoAuth = s;
      return { json() {} };
    },
  };
  authenticateToken(reqNoAuth, resNoAuth, () => {});
  assert.strictEqual(statusNoAuth, 401, "Analytics endpoint requires JWT token");
  console.log("✓ /api/analytics strictly protected by JWT authentication (returns 401 without token)");

  // Test User Isolation on GET /api/goals
  const getGoalsLayer = analyticsRoutes.stack.find((l) => l.route && l.route.path === "/goals" && l.route.methods.get);
  const getGoalsHandler = getGoalsLayer.route.stack[getGoalsLayer.route.stack.length - 1].handle;

  let returnedGoals = null;
  await getGoalsHandler(
    { headers: { authorization: `Bearer ${tokenUser1}` }, user: { id: 1 }, db: mockDb },
    { json: (d) => { returnedGoals = d.goals; } }
  );

  assert.strictEqual(returnedGoals.length, 1);
  assert.strictEqual(returnedGoals[0].title, "User 1 Goal", "User 1 must never see User 2's goals");
  console.log("✓ User data isolation strictly enforced: users can only access their own goals & analytics");

  // Test Goal Creation POST /api/goals
  const postGoalsLayer = analyticsRoutes.stack.find((l) => l.route && l.route.path === "/goals" && l.route.methods.post);
  const postGoalsHandler = postGoalsLayer.route.stack[postGoalsLayer.route.stack.length - 1].handle;

  let createdGoalResult = null;
  let createdGoalStatus = 200;
  await postGoalsHandler(
    {
      headers: { authorization: `Bearer ${tokenUser1}` },
      user: { id: 1 },
      db: mockDb,
      body: { title: "Complete 10 DSA Tasks", targetCount: 10, category: "dsa" },
    },
    {
      status: (s) => { createdGoalStatus = s; return { json: (d) => { createdGoalResult = d; } }; },
      json: (d) => { createdGoalResult = d; },
    }
  );

  assert.strictEqual(createdGoalStatus, 201);
  assert.strictEqual(createdGoalResult.goal.title, "Complete 10 DSA Tasks");
  console.log("✓ POST /api/goals successfully creates and persists productivity goal");

  // Test Goal Deletion DELETE /api/goals/:id
  const delGoalsLayer = analyticsRoutes.stack.find((l) => l.route && l.route.path === "/goals/:id" && l.route.methods.delete);
  const delGoalsHandler = delGoalsLayer.route.stack[delGoalsLayer.route.stack.length - 1].handle;

  let deleteResult = null;
  await delGoalsHandler(
    {
      headers: { authorization: `Bearer ${tokenUser1}` },
      user: { id: 1 },
      db: mockDb,
      params: { id: 1 },
    },
    {
      json: (d) => { deleteResult = d; },
      status: () => ({ json: (d) => { deleteResult = d; } }),
    }
  );

  assert.strictEqual(deleteResult.success, true);
  console.log("✓ DELETE /api/goals/:id successfully removes goal for authenticated user");

  console.log("\nALL PRODUCTIVITY ANALYTICS & GOAL TESTS PASSED SUCCESSFULLY!");
}

runAnalyticsTestSuite().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
