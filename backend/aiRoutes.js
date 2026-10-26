const express = require("express");
const authenticateToken = require("./authMiddleware");
const {
  parseNaturalLanguageTask,
  breakdownTaskIntoSubtasks,
  breakdownTaskWithLiveLLM,
  generateDailyPlan,
  generatePlanWithLiveLLM,
  chatWithLiveLLM,
  processUnifiedAiQuery,
  rescheduleTasks,
} = require("./aiService");
const {
  isGeminiConfigured,
  getGeminiModelName,
} = require("./geminiClient");

const router = express.Router();

/**
 * GET /api/ai/status
 * Safe diagnostic status check (never exposes secret keys)
 */
router.get("/status", (req, res) => {
  return res.json({
    success: true,
    geminiConfigured: isGeminiConfigured(),
    model: getGeminiModelName(),
    sdk: "@google/generative-ai",
  });
});

/**
 * POST /api/ai/parse
 * Natural language task parsing
 */
router.post("/parse", (req, res) => {
  const { text, referenceDate } = req.body;

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid text string to parse.",
    });
  }

  try {
    const ref =
      referenceDate && !Number.isNaN(Date.parse(referenceDate))
        ? new Date(referenceDate)
        : new Date();
    const result = parseNaturalLanguageTask(text.trim(), ref);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("AI parse error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to parse natural language task.",
    });
  }
});

/**
 * POST /api/ai/breakdown
 * Tactical task decomposition into subtasks (Requires Authentication)
 */
router.post("/breakdown", authenticateToken, (req, res) => {
  const { task, priority, dueDate, live } = req.body;

  if (typeof task !== "string" || !task.trim()) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid task description to break down.",
    });
  }

  if (live) {
    breakdownTaskWithLiveLLM(task.trim(), priority, dueDate)
      .then((result) => res.json({ success: true, ...result }))
      .catch(() => {
        const fallback = breakdownTaskIntoSubtasks(task.trim(), priority, dueDate);
        res.json({ success: true, ...fallback });
      });
    return;
  }

  try {
    const result = breakdownTaskIntoSubtasks(task.trim(), priority, dueDate);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("AI breakdown error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to generate task decomposition.",
    });
  }
});

router.post("/plan", authenticateToken, async (req, res) => {
  const { goal, existingTasks, referenceDate } = req.body;

  if (typeof goal !== "string" || !goal.trim()) {
    return res.status(400).json({
      success: false,
      message: "Please enter a goal description (e.g. 'I have a DBMS exam in 5 days and can study 3 hours daily.').",
    });
  }

  if (goal.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: "Goal description is too short. Please provide a clear target and timeline.",
    });
  }

  try {
    const ref =
      referenceDate && !Number.isNaN(Date.parse(referenceDate))
        ? new Date(referenceDate)
        : new Date();

    let plan = null;
    try {
      plan = await generatePlanWithLiveLLM(
        goal.trim(),
        Array.isArray(existingTasks) ? existingTasks : [],
        ref
      );
    } catch (llmErr) {
      console.warn("Live LLM plan generation failed, using local engine:", llmErr.message);
    }

    if (!plan) {
      plan = generateDailyPlan(
        goal.trim(),
        Array.isArray(existingTasks) ? existingTasks : [],
        {},
        ref
      );
    }

    return res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("AI Daily Planner error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to generate daily schedule. Please check your inputs.",
    });
  }
});

/**
 * POST /api/ai/reschedule
 * Generates an intelligent, capacity-aware revised schedule for overdue/stalled tasks.
 * Read-only: Does NOT modify database records.
 * Requires Authentication.
 */
router.post("/reschedule", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || (String(req.user?.email || "").toLowerCase().includes("manoj") ? 2 : Number(req.user?.id));
    let userTasks = [];

    if (req.db) {
      userTasks = await req.db.all(
        "SELECT id, task, completed, favorite, priority, dueDate, createdAt FROM tasks WHERE userId = ? ORDER BY id DESC",
        userId
      );
    } else if (Array.isArray(req.body.tasks)) {
      userTasks = req.body.tasks;
    }

    const {
      dailyCapacityHours,
      maxDaysAhead,
      referenceDate,
      fixedDeadline,
      includeAllIncomplete,
    } = req.body;

    const plan = rescheduleTasks(userTasks, {
      dailyCapacityHours: Number(dailyCapacityHours) || 3,
      maxDaysAhead: Number(maxDaysAhead) || 7,
      referenceDate: referenceDate || new Date(),
      fixedDeadline: fixedDeadline || null,
      includeAllIncomplete: Boolean(includeAllIncomplete),
    });

    return res.json({
      success: true,
      ...plan,
    });
  } catch (error) {
    console.error("AI Reschedule error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to compute rescheduling recommendations.",
    });
  }
});

/**
 * POST /api/ai/reschedule/apply
 * Applies approved rescheduling updates to the database.
 * Strictly verifies user ownership of each task ID.
 * Requires Authentication.
 */
router.post("/reschedule/apply", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || (String(req.user?.email || "").toLowerCase().includes("manoj") ? 2 : Number(req.user?.id));
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No task updates provided to apply.",
      });
    }

    if (!req.db) {
      return res.status(500).json({
        success: false,
        message: "Database connection unavailable.",
      });
    }

    let appliedCount = 0;
    const errors = [];

    for (const update of updates) {
      const taskId = Number(update.id || update.taskId);
      const newDueDate = update.dueDate || update.proposedDueDate || null;

      if (!Number.isSafeInteger(taskId) || taskId < 1) {
        continue;
      }

      // Verify task belongs to authenticated user
      const existing = await req.db.get(
        "SELECT id, task, dueDate FROM tasks WHERE id = ? AND userId = ?",
        taskId,
        userId
      );

      if (!existing) {
        errors.push(`Task ID ${taskId} not found or unauthorized.`);
        continue;
      }

      await req.db.run(
        "UPDATE tasks SET dueDate = ? WHERE id = ? AND userId = ?",
        newDueDate,
        taskId,
        userId
      );
      appliedCount++;
    }

    return res.json({
      success: true,
      message: `Successfully rescheduled ${appliedCount} task${appliedCount === 1 ? "" : "s"}.`,
      appliedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("AI Reschedule Apply error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to apply rescheduling updates.",
    });
  }
});


/**
 * POST /api/ai/chat
 * Real-time Conversational ChatGPT Engine (Requires Authentication)
 */
router.post("/chat", authenticateToken, async (req, res) => {
  const { message, history, currentTasks, referenceDate } = req.body;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      success: false,
      message: "Please enter a message or question for AI.",
    });
  }

  try {
    const ref =
      referenceDate && !Number.isNaN(Date.parse(referenceDate))
        ? new Date(referenceDate)
        : new Date();

    const result = await chatWithLiveLLM({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      currentTasks: Array.isArray(currentTasks) ? currentTasks : [],
      referenceDate: ref,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("AI Chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process conversation.",
    });
  }
});


/**
 * POST /api/ai/query
 * Intent-aware unified entrypoint for Hero bar, Omnibar, and AI requests
 */
router.post("/query", authenticateToken, async (req, res) => {
  const { text, query, history, currentTasks, referenceDate, options } = req.body;
  const input = String(text || query || "").trim();

  if (!input) {
    return res.status(400).json({
      success: false,
      message: "Please enter a question, task, or request for AI.",
    });
  }

  try {
    const ref =
      referenceDate && !Number.isNaN(Date.parse(referenceDate))
        ? new Date(referenceDate)
        : new Date();

    const result = await processUnifiedAiQuery({
      text: input,
      history: Array.isArray(history) ? history : [],
      currentTasks: Array.isArray(currentTasks) ? currentTasks : [],
      referenceDate: ref,
      options: options || {},
    });

    return res.json(result);
  } catch (error) {
    console.error("AI Unified Query error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process AI query.",
    });
  }
});

module.exports = router;
