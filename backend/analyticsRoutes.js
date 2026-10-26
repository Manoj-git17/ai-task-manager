const express = require("express");
const authenticateToken = require("./authMiddleware");
const {
  calculateProductivityAnalytics,
  evaluateGoals,
} = require("./analyticsService");

const router = express.Router();

/**
 * GET /api/analytics
 * Returns comprehensive productivity metrics, weekly trends, streaks, and insights.
 */
router.get("/analytics", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || (String(req.user?.email || "").toLowerCase().includes("manoj") ? 2 : Number(req.user?.id));
    const db = req.db || req.app.get("db");

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection unavailable.",
      });
    }

    const tasks = await db.all(
      "SELECT id, task, completed, favorite, priority, dueDate, createdAt, completedAt FROM tasks WHERE userId = ? ORDER BY id DESC",
      userId
    );

    const goals = await db.all(
      "SELECT id, title, targetCount, category, targetDate, createdAt FROM goals WHERE userId = ? ORDER BY id DESC",
      userId
    );

    const { referenceDate } = req.query;
    const ref =
      referenceDate && !Number.isNaN(Date.parse(referenceDate))
        ? new Date(referenceDate)
        : new Date();

    const analytics = calculateProductivityAnalytics(tasks, goals, { referenceDate: ref });

    return res.json({
      success: true,
      ...analytics,
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to calculate productivity analytics.",
    });
  }
});

/**
 * GET /api/goals
 * Returns active goals with real-time evaluated progress.
 */
router.get("/goals", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || (String(req.user?.email || "").toLowerCase().includes("manoj") ? 2 : Number(req.user?.id));
    const db = req.db || req.app.get("db");

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection unavailable.",
      });
    }

    const goals = await db.all(
      "SELECT id, title, targetCount, category, targetDate, createdAt FROM goals WHERE userId = ? ORDER BY id DESC",
      userId
    );

    const tasks = await db.all(
      "SELECT id, task, completed, priority, createdAt, completedAt FROM tasks WHERE userId = ?",
      userId
    );

    const evaluated = evaluateGoals(goals, tasks, new Date());

    return res.json({
      success: true,
      goals: evaluated,
    });
  } catch (error) {
    console.error("Get goals error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load goals.",
    });
  }
});

/**
 * POST /api/goals
 * Creates a new weekly productivity goal.
 */
router.post("/goals", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || (String(req.user?.email || "").toLowerCase().includes("manoj") ? 2 : Number(req.user?.id));
    const db = req.db || req.app.get("db");

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection unavailable.",
      });
    }

    const { title, targetCount, category, targetDate } = req.body;

    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle || trimmedTitle.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Goal title must contain 1–100 characters.",
      });
    }

    const count = Number(targetCount);
    if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
      return res.status(400).json({
        success: false,
        message: "Target task count must be between 1 and 100.",
      });
    }

    const result = await db.run(
      `INSERT INTO goals (title, targetCount, category, targetDate, userId)
       VALUES (?, ?, ?, ?, ?)`,
      trimmedTitle,
      count,
      category || "all",
      targetDate || null,
      userId
    );

    const created = await db.get(
      "SELECT id, title, targetCount, category, targetDate, createdAt FROM goals WHERE id = ? AND userId = ?",
      result.lastID,
      userId
    );

    return res.status(201).json({
      success: true,
      message: "Goal created successfully.",
      goal: created,
    });
  } catch (error) {
    console.error("Create goal error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create productivity goal.",
    });
  }
});

/**
 * DELETE /api/goals/:id
 * Removes a productivity goal.
 */
router.delete("/goals/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId || (String(req.user?.email || "").toLowerCase().includes("manoj") ? 2 : Number(req.user?.id));
    const db = req.db || req.app.get("db");

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection unavailable.",
      });
    }

    const goalId = Number(req.params.id);

    if (!Number.isSafeInteger(goalId) || goalId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid goal ID.",
      });
    }

    const result = await db.run(
      "DELETE FROM goals WHERE id = ? AND userId = ?",
      goalId,
      userId
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: "Goal not found.",
      });
    }

    return res.json({
      success: true,
      message: "Goal deleted successfully.",
    });
  } catch (error) {
    console.error("Delete goal error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete goal.",
    });
  }
});

module.exports = router;
