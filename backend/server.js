require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const initializeDB = require("./db");
const authenticateToken = require("./authMiddleware");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
      : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

let db;

/* -------------------- HELPERS -------------------- */

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function signToken(user) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    secret,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function normalizeTask(task) {
  return {
    ...task,
    completed: Boolean(task.completed),
    favorite: Boolean(task.favorite),
  };
}

function getUserId(req) {
  return Number(req.user?.id);
}

function validTaskText(task) {
  return (
    typeof task === "string" &&
    task.trim().length > 0 &&
    task.trim().length <= 500
  );
}

function validPriority(priority) {
  return ["Low", "Medium", "High"].includes(priority);
}

function validDate(value) {
  if (value === null || value === undefined || value === "") {
    return true;
  }

  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value))
  );
}

function getTaskInput(body, existingTask = {}) {
  return {
    task:
      body.task === undefined
        ? existingTask.task
        : body.task.trim(),

    priority:
      body.priority === undefined
        ? existingTask.priority
        : body.priority,

    dueDate:
      body.dueDate === undefined
        ? existingTask.dueDate
        : body.dueDate || null,

    completed:
      body.completed === undefined
        ? Boolean(existingTask.completed)
        : body.completed,

    favorite:
      body.favorite === undefined
        ? Boolean(existingTask.favorite)
        : body.favorite,
  };
}

/* -------------------- HEALTH CHECK -------------------- */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Task Manager API is running.",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is healthy.",
    database: db ? "connected" : "initializing",
  });
});

/* -------------------- AUTHENTICATION -------------------- */

app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!name || name.length > 100) {
      return sendError(
        res,
        400,
        "Please enter a name between 1 and 100 characters."
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, 400, "Please enter a valid email address.");
    }

    if (typeof password !== "string" || password.length < 8) {
      return sendError(
        res,
        400,
        "Password must contain at least 8 characters."
      );
    }

    if (password.length > 72) {
      return sendError(
        res,
        400,
        "Password must not exceed 72 characters."
      );
    }

    const existingUser = await db.get(
      "SELECT id FROM users WHERE email = ?",
      email
    );

    if (existingUser) {
      return sendError(
        res,
        409,
        "An account with this email already exists. Please log in."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      name,
      email,
      hashedPassword
    );

    const user = {
      id: result.lastID,
      name,
      email,
    };

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return sendError(
        res,
        409,
        "An account with this email already exists."
      );
    }

    return sendError(res, 500, "Unable to create your account.");
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!email || typeof password !== "string" || !password) {
      return sendError(res, 400, "Please enter your email and password.");
    }

    const user = await db.get(
      "SELECT id, name, email, password FROM users WHERE email = ?",
      email
    );

    if (!user) {
      return sendError(res, 401, "Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return sendError(res, 401, "Invalid email or password.");
    }

    const token = signToken(user);

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return sendError(res, 500, "Unable to log in right now.");
  }
});

app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const user = await db.get(
      "SELECT id, name, email FROM users WHERE id = ?",
      getUserId(req)
    );

    if (!user) {
      return sendError(res, 404, "Account not found. Please register again.");
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Profile error:", error.message);
    return sendError(res, 500, "Unable to load your profile.");
  }
});

/* -------------------- GET TASKS -------------------- */

app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const tasks = await db.all(
      `SELECT id, task, completed, favorite, priority, dueDate, createdAt
       FROM tasks
       WHERE userId = ?
       ORDER BY id DESC`,
      getUserId(req)
    );

    return res.json({
      success: true,
      tasks: tasks.map(normalizeTask),
    });
  } catch (error) {
    console.error("Get tasks error:", error.message);
    return sendError(res, 500, "Unable to load your tasks.");
  }
});

/* -------------------- CREATE TASK -------------------- */

app.post("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const { task, priority, dueDate } = req.body;

    if (!validTaskText(task)) {
      return sendError(
        res,
        400,
        "Task description must contain 1–500 characters."
      );
    }

    if (
      priority !== undefined &&
      !validPriority(priority)
    ) {
      return sendError(res, 400, "Please select a valid priority.");
    }

    if (!validDate(dueDate)) {
      return sendError(res, 400, "Please provide a valid due date.");
    }

    const createdAt = new Date().toISOString();

    const result = await db.run(
      `INSERT INTO tasks
       (task, completed, favorite, priority, dueDate, createdAt, userId)
       VALUES (?, 0, 0, ?, ?, ?, ?)`,
      task.trim(),
      priority || "Medium",
      dueDate || null,
      createdAt,
      getUserId(req)
    );

    const newTask = await db.get(
      `SELECT id, task, completed, favorite, priority, dueDate, createdAt
       FROM tasks
       WHERE id = ? AND userId = ?`,
      result.lastID,
      getUserId(req)
    );

    return res.status(201).json({
      success: true,
      message: "Task created successfully.",
      task: normalizeTask(newTask),
    });
  } catch (error) {
    console.error("Create task error:", error.message);
    return sendError(res, 500, "Unable to create your task.");
  }
});

/* -------------------- UPDATE TASK -------------------- */

app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const taskId = Number(req.params.id);

    if (!Number.isSafeInteger(taskId) || taskId < 1) {
      return sendError(res, 400, "Invalid task ID.");
    }

    const existingTask = await db.get(
      "SELECT * FROM tasks WHERE id = ? AND userId = ?",
      taskId,
      getUserId(req)
    );

    if (!existingTask) {
      return sendError(res, 404, "Task not found.");
    }

    const updated = getTaskInput(req.body, existingTask);

    if (!validTaskText(updated.task)) {
      return sendError(
        res,
        400,
        "Task description must contain 1–500 characters."
      );
    }

    if (!validPriority(updated.priority)) {
      return sendError(res, 400, "Please select a valid priority.");
    }

    if (typeof updated.completed !== "boolean") {
      return sendError(res, 400, "Invalid completed status.");
    }

    if (typeof updated.favorite !== "boolean") {
      return sendError(res, 400, "Invalid favorite status.");
    }

    if (!validDate(updated.dueDate)) {
      return sendError(res, 400, "Please provide a valid due date.");
    }

    await db.run(
      `UPDATE tasks
       SET task = ?, completed = ?, favorite = ?,
           priority = ?, dueDate = ?
       WHERE id = ? AND userId = ?`,
      updated.task,
      Number(updated.completed),
      Number(updated.favorite),
      updated.priority,
      updated.dueDate || null,
      taskId,
      getUserId(req)
    );

    const task = await db.get(
      `SELECT id, task, completed, favorite, priority, dueDate, createdAt
       FROM tasks
       WHERE id = ? AND userId = ?`,
      taskId,
      getUserId(req)
    );

    return res.json({
      success: true,
      message: "Task updated successfully.",
      task: normalizeTask(task),
    });
  } catch (error) {
    console.error("Update task error:", error.message);
    return sendError(res, 500, "Unable to update your task.");
  }
});

/* -------------------- PATCH TASK -------------------- */

app.patch("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const taskId = Number(req.params.id);

    if (!Number.isSafeInteger(taskId) || taskId < 1) {
      return sendError(res, 400, "Invalid task ID.");
    }

    const existingTask = await db.get(
      "SELECT * FROM tasks WHERE id = ? AND userId = ?",
      taskId,
      getUserId(req)
    );

    if (!existingTask) {
      return sendError(res, 404, "Task not found.");
    }

    const allowedFields = ["task", "completed", "favorite", "priority", "dueDate"];
    const hasAllowedField = allowedFields.some((field) =>
      Object.prototype.hasOwnProperty.call(req.body, field)
    );

    if (!hasAllowedField) {
      return sendError(res, 400, "No valid task fields provided.");
    }

    const updated = getTaskInput(req.body, existingTask);

    if (!validTaskText(updated.task)) {
      return sendError(res, 400, "Invalid task description.");
    }

    if (!validPriority(updated.priority)) {
      return sendError(res, 400, "Invalid priority.");
    }

    if (typeof updated.completed !== "boolean" ||
        typeof updated.favorite !== "boolean") {
      return sendError(res, 400, "Invalid task status.");
    }

    if (!validDate(updated.dueDate)) {
      return sendError(res, 400, "Invalid due date.");
    }

    await db.run(
      `UPDATE tasks
       SET task = ?, completed = ?, favorite = ?,
           priority = ?, dueDate = ?
       WHERE id = ? AND userId = ?`,
      updated.task,
      Number(updated.completed),
      Number(updated.favorite),
      updated.priority,
      updated.dueDate || null,
      taskId,
      getUserId(req)
    );

    const task = await db.get(
      `SELECT id, task, completed, favorite, priority, dueDate, createdAt
       FROM tasks
       WHERE id = ? AND userId = ?`,
      taskId,
      getUserId(req)
    );

    return res.json({
      success: true,
      message: "Task updated successfully.",
      task: normalizeTask(task),
    });
  } catch (error) {
    console.error("Patch task error:", error.message);
    return sendError(res, 500, "Unable to update your task.");
  }
});

/* -------------------- DELETE TASK -------------------- */

app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const taskId = Number(req.params.id);

    if (!Number.isSafeInteger(taskId) || taskId < 1) {
      return sendError(res, 400, "Invalid task ID.");
    }

    const result = await db.run(
      "DELETE FROM tasks WHERE id = ? AND userId = ?",
      taskId,
      getUserId(req)
    );

    if (result.changes === 0) {
      return sendError(res, 404, "Task not found.");
    }

    return res.json({
      success: true,
      message: "Task deleted successfully.",
    });
  } catch (error) {
    console.error("Delete task error:", error.message);
    return sendError(res, 500, "Unable to delete your task.");
  }
});

/* -------------------- START SERVER -------------------- */

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    db = await initializeDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`AI Task Manager API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

startServer();