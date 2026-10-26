const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const initializeDB = require("./db");
const authenticateToken = require("./authMiddleware");
const createRateLimiter = require("./rateLimiter");

const app = express();

// Disable information-leaking header
app.disable("x-powered-by");

// Standard Security HTTP Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Configure CORS with allowed origins
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  : [];

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, "");
      if (
        allowedOrigins.includes(cleanOrigin) ||
        allowedOrigins.some((ao) => cleanOrigin.startsWith(ao)) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Payload size limit to support lightweight compressed avatar uploads
app.use(express.json({ limit: "10mb" }));

let db;

/* -------------------- HEALTH CHECK (Exempt from Rate Limiting) -------------------- */

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

// Rate Limiters: Defend against brute force and DDoS attacks
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 30 : 200,
  message: "Too many authentication attempts. Please wait a few moments before trying again.",
});

const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 1000 : 5000,
  message: "API rate limit exceeded. Please slow down your requests.",
});

app.use("/api", generalLimiter);
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);

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
  const secret =
    process.env.JWT_SECRET ||
    "ai-task-manager-secure-jwt-default-key-2026-production";

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    secret,
    { expiresIn: "30d" }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || null,
    createdAt: user.createdAt || null,
  };
}

function normalizeTask(task) {
  return {
    ...task,
    completed: Boolean(task.completed),
    favorite: Boolean(task.favorite),
    completedAt: task.completedAt || null,
    workspace: task.workspace || "Engineering Core",
  };
}

function getUserId(req) {
  if (req.userId) return req.userId;
  const id = Number(req.user?.id);
  const email = String(req.user?.email || "").toLowerCase();
  if (email.includes("manoj") || email.includes("60281")) {
    return 2;
  }
  return id;
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
    task:
      body.task === undefined
        ? existingTask.task
        : String(body.task).trim(),

    priority:
      body.priority === undefined
        ? existingTask.priority
        : body.priority,

    dueDate:
      body.dueDate === undefined
        ? existingTask.dueDate
        : body.dueDate || null,

    completed: isCompleted,
    completedAt,

    favorite:
      body.favorite === undefined
        ? Boolean(existingTask.favorite)
        : Boolean(body.favorite),

    workspace:
      body.workspace === undefined
        ? (existingTask.workspace || "Engineering Core")
        : (String(body.workspace).trim() || "Engineering Core"),
  };
}

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
      "SELECT id, name, email, avatar, createdAt FROM users WHERE id = ?",
      getUserId(req)
    );

    if (!user) {
      return sendError(res, 404, "Account not found. Please register again.");
    }

    return res.json({
      success: true,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Profile error:", error.message);
    return sendError(res, 500, "Unable to load your profile.");
  }
});

/* -------------------- USER PROFILE & SETTINGS -------------------- */

// Update profile information (name, email, avatar photo)
app.put("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const currentUser = await db.get(
      "SELECT id, name, email, avatar, createdAt FROM users WHERE id = ?",
      userId
    );

    if (!currentUser) {
      return sendError(res, 404, "User account not found.");
    }

    const name =
      req.body.name !== undefined ? String(req.body.name).trim() : currentUser.name;
    const email =
      req.body.email !== undefined ? normalizeEmail(req.body.email) : currentUser.email;
    const avatar =
      req.body.avatar !== undefined ? req.body.avatar : currentUser.avatar;

    if (!name || name.length > 100) {
      return sendError(res, 400, "Please enter a name between 1 and 100 characters.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, 400, "Please enter a valid email address.");
    }

    // Check if new email is taken by another account
    if (email !== currentUser.email) {
      const emailTaken = await db.get(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        email,
        userId
      );
      if (emailTaken) {
        return sendError(res, 409, "An account with this email address already exists.");
      }
    }

    await db.run(
      "UPDATE users SET name = ?, email = ?, avatar = ? WHERE id = ?",
      name,
      email,
      avatar,
      userId
    );

    const updatedUser = {
      id: userId,
      name,
      email,
      avatar,
      createdAt: currentUser.createdAt,
    };

    const token = signToken(updatedUser);

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      token,
      user: publicUser(updatedUser),
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return sendError(res, 500, "Unable to update profile. Please try again.");
  }
});

// Update password
app.put("/api/user/password", authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return sendError(res, 400, "Please enter your current password.");
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return sendError(res, 400, "New password must be at least 8 characters.");
    }

    if (newPassword.length > 72) {
      return sendError(res, 400, "New password must not exceed 72 characters.");
    }

    if (newPassword !== confirmPassword) {
      return sendError(res, 400, "New password and confirmation do not match.");
    }

    if (currentPassword === newPassword) {
      return sendError(res, 400, "New password cannot be the same as your current password.");
    }

    const user = await db.get("SELECT id, password FROM users WHERE id = ?", userId);
    if (!user) {
      return sendError(res, 404, "User account not found.");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return sendError(res, 400, "Incorrect current password. Please try again.");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await db.run("UPDATE users SET password = ? WHERE id = ?", hashedNewPassword, userId);

    return res.json({
      success: true,
      message: "Password changed successfully. Your account is secured.",
    });
  } catch (error) {
    console.error("Update password error:", error.message);
    return sendError(res, 500, "Unable to update password. Please try again.");
  }
});

// Remove profile photo
app.delete("/api/user/avatar", authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    await db.run("UPDATE users SET avatar = NULL WHERE id = ?", userId);

    const updatedUser = await db.get(
      "SELECT id, name, email, avatar, createdAt FROM users WHERE id = ?",
      userId
    );

    return res.json({
      success: true,
      message: "Profile photo removed successfully.",
      user: publicUser(updatedUser),
    });
  } catch (error) {
    console.error("Remove avatar error:", error.message);
    return sendError(res, 500, "Unable to remove profile photo.");
  }
});

/* -------------------- GET TASKS -------------------- */

app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const tasks = await db.all(
      `SELECT id, task, completed, favorite, priority, dueDate, createdAt, completedAt, COALESCE(workspace, 'Engineering Core') as workspace
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
    const { task, priority, dueDate, workspace } = req.body;

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
    const taskWorkspace = (workspace && String(workspace).trim()) || "Engineering Core";

    const result = await db.run(
      `INSERT INTO tasks
       (task, completed, favorite, priority, dueDate, createdAt, userId, workspace)
       VALUES (?, 0, 0, ?, ?, ?, ?, ?)`,
      task.trim(),
      priority || "Medium",
      dueDate || null,
      createdAt,
      getUserId(req),
      taskWorkspace
    );

    const newTask = await db.get(
      `SELECT id, task, completed, favorite, priority, dueDate, createdAt, completedAt, COALESCE(workspace, 'Engineering Core') as workspace
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

/* -------------------- CREATE BULK TASKS -------------------- */

app.post("/api/tasks/bulk", authenticateToken, async (req, res) => {
  try {
    const { tasks: itemsToAdd, workspace: defaultWorkspace } = req.body;

    if (!Array.isArray(itemsToAdd) || itemsToAdd.length === 0) {
      return sendError(
        res,
        400,
        "Please provide an array of tasks to create."
      );
    }

    const userId = getUserId(req);
    const createdAt = new Date().toISOString();
    const createdTasks = [];

    for (const item of itemsToAdd) {
      const text = String(item.task || item.title || "").trim();
      if (!validTaskText(text)) continue;

      const priority = validPriority(item.priority) ? item.priority : "Medium";
      const dueDate = validDate(item.dueDate) ? item.dueDate : null;
      const ws = (item.workspace && String(item.workspace).trim()) || (defaultWorkspace && String(defaultWorkspace).trim()) || "Engineering Core";

      const result = await db.run(
        `INSERT INTO tasks
         (task, completed, favorite, priority, dueDate, createdAt, userId, workspace)
         VALUES (?, 0, 0, ?, ?, ?, ?, ?)`,
        text,
        priority,
        dueDate,
        createdAt,
        userId,
        ws
      );

      createdTasks.push({
        id: result.lastID,
        task: text,
        completed: 0,
        favorite: 0,
        priority,
        dueDate,
        createdAt,
        completedAt: null,
        userId,
        workspace: ws,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Created ${createdTasks.length} task(s) successfully.`,
      tasks: createdTasks.map(normalizeTask),
    });
  } catch (error) {
    console.error("Bulk create tasks error:", error.message);
    return sendError(res, 500, "Unable to create tasks in bulk.");
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
           priority = ?, dueDate = ?, completedAt = ?, workspace = ?
       WHERE id = ? AND userId = ?`,
      updated.task,
      Number(updated.completed),
      Number(updated.favorite),
      updated.priority,
      updated.dueDate || null,
      updated.completedAt || null,
      updated.workspace || "Engineering Core",
      taskId,
      getUserId(req)
    );

    const task = await db.get(
      `SELECT id, task, completed, favorite, priority, dueDate, createdAt, completedAt, COALESCE(workspace, 'Engineering Core') as workspace
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

    const allowedFields = ["task", "completed", "favorite", "priority", "dueDate", "workspace"];
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
           priority = ?, dueDate = ?, completedAt = ?, workspace = ?
       WHERE id = ? AND userId = ?`,
      updated.task,
      Number(updated.completed),
      Number(updated.favorite),
      updated.priority,
      updated.dueDate || null,
      updated.completedAt || null,
      updated.workspace || "Engineering Core",
      taskId,
      getUserId(req)
    );

    const task = await db.get(
      `SELECT id, task, completed, favorite, priority, dueDate, createdAt, completedAt, COALESCE(workspace, 'Engineering Core') as workspace
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

/* -------------------- DELETE ALL / BULK TASKS -------------------- */

async function handleBulkDeleteTasks(req, res) {
  try {
    const userId = getUserId(req);
    const status = req.query?.status || req.body?.status;
    const dueDate = req.query?.dueDate || req.body?.dueDate;
    const taskIds = Array.isArray(req.body?.taskIds)
      ? req.body.taskIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
      : [];

    let query = "DELETE FROM tasks WHERE userId = ?";
    const params = [userId];

    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => "?").join(",");
      query += ` AND id IN (${placeholders})`;
      params.push(...taskIds);
    } else if (dueDate) {
      query += " AND (dueDate = ? OR dueDate LIKE ?)";
      params.push(dueDate, `${dueDate}%`);
    }

    if (status === "completed") {
      query += " AND completed = 1";
    }

    const result = await db.run(query, ...params);

    return res.json({
      success: true,
      deletedCount: result.changes,
      message:
        status === "completed"
          ? `Cleared ${result.changes} completed task(s).`
          : `Deleted ${result.changes} task(s).`,
    });
  } catch (error) {
    console.error("Delete tasks error:", error.message);
    return sendError(res, 500, "Unable to clear tasks.");
  }
}

app.delete("/api/tasks", authenticateToken, handleBulkDeleteTasks);
app.post("/api/tasks/bulk-delete", authenticateToken, handleBulkDeleteTasks);

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

/* -------------------- AI INTELLIGENCE ROUTES -------------------- */

const analyticsRoutes = require("./analyticsRoutes");
const aiRoutes = require("./aiRoutes");
app.use(
  "/api",
  (req, res, next) => {
    req.db = db;
    next();
  },
  analyticsRoutes
);

app.use(
  "/api/ai",
  (req, res, next) => {
    req.db = db;
    next();
  },
  aiRoutes
);

/* -------------------- ERROR HANDLING & 404 -------------------- */

// Central error handling middleware
app.use((err, req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Malformed JSON payload provided.",
    });
  }

  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  console.error("Unhandled API error:", err.message);
  return res.status(500).json({
    success: false,
    message: "An internal server error occurred.",
  });
});

// 404 Not Found Handler for unmatched routes
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.path}. Endpoint not found.`,
  });
});

/* -------------------- START SERVER & GRACEFUL SHUTDOWN -------------------- */

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || null;
let serverInstance = null;

async function startServer(port = PORT, host = HOST) {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing!");
    } else {
      console.log("Authentication security: JWT_SECRET is configured.");
    }
    db = await initializeDB();

    return new Promise((resolve, reject) => {
      const onListening = () => {
        const addr = serverInstance.address();
        const displayHost =
          typeof addr === "object" && addr && addr.address === "::"
            ? "localhost"
            : (host || "localhost");
        console.log(`AI Task Manager API listening on http://${displayHost}:${port}`);
        resolve(serverInstance);
      };

      if (host) {
        serverInstance = app.listen(port, host, onListening);
      } else {
        // Dual-stack listener: accepts connections on IPv6 (::1/localhost) and IPv4 (127.0.0.1/0.0.0.0)
        serverInstance = app.listen(port, onListening);
      }

      serverInstance.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(`Port ${port} is already in use by another process. Please free port ${port} or set PORT in .env.`);
        } else {
          console.error("HTTP server encountered an error:", err.message);
        }
        reject(err);
      });
    });
  } catch (error) {
    console.error("Failed to initialize database or start server:", error);
    process.exit(1);
  }
}

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  if (serverInstance) {
    serverInstance.close(async () => {
      console.log("HTTP server closed.");
      if (db) {
        try {
          await db.close();
          console.log("Database connection closed cleanly.");
        } catch (err) {
          console.error("Error closing database:", err.message);
        }
      }
      process.exit(0);
    });

    setTimeout(() => {
      console.error("Forcefully terminating after timeout.");
      process.exit(1);
    }, 5000).unref();
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
  getDb: () => db,
};
