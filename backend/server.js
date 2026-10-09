require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const initializeDB = require("./db");
const authenticateToken = require("./authMiddleware");

const app = express();
let db = null;

const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());


// ==========================================
// REGISTER USER
// ==========================================

app.post("/register", async (request, response) => {
  try {
    const { name, email, password } = request.body;

    if (!name || !email || !password) {
      return response.status(400).send({
        message: "Name, email and password are required",
      });
    }

    const existingUser = await db.get(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existingUser) {
      return response.status(400).send({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.run(
      `
      INSERT INTO users (name, email, password)
      VALUES (?, ?, ?)
      `,
      [name, email, hashedPassword]
    );

    response.status(201).send({
      message: "User Registered Successfully",
    });

  } catch (error) {
    console.log(error);

    response.status(500).send({
      message: "Registration failed",
    });
  }
});


// ==========================================
// LOGIN USER
// ==========================================

app.post("/login", async (request, response) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return response.status(400).send({
        message: "Email and password are required",
      });
    }

    const user = await db.get(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (!user) {
      return response.status(401).send({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return response.status(401).send({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    response.send({
      message: "Login Successful",
      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.log(error);

    response.status(500).send({
      message: "Login failed",
    });
  }
});


// ==========================================
// GET LOGGED-IN USER TASKS
// ==========================================

app.get("/tasks", authenticateToken, async (request, response) => {
  try {
    const userId = request.user.id;

    const tasks = await db.all(
      `
      SELECT * FROM tasks
      WHERE userId = ?
      ORDER BY id DESC
      `,
      [userId]
    );

    response.send(tasks);

  } catch (error) {
    console.log(error);

    response.status(500).send({
      message: "Failed to get tasks",
    });
  }
});


// ==========================================
// ADD TASK
// ==========================================

app.post("/tasks", authenticateToken, async (request, response) => {
  try {
    const { task, priority = "Medium", dueDate } = request.body;

    const userId = request.user.id;

    if (!task || task.trim() === "") {
      return response.status(400).send({
        message: "Task is required",
      });
    }

    const createdAt = new Date().toISOString();

    await db.run(
      `
      INSERT INTO tasks
      (
        task,
        completed,
        favorite,
        priority,
        dueDate,
        createdAt,
        userId
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        task.trim(),
        0,
        0,
        priority,
        dueDate || null,
        createdAt,
        userId,
      ]
    );

    response.status(201).send({
      message: "Task Added Successfully",
    });

  } catch (error) {
    console.log(error);

    response.status(500).send({
      message: "Failed to add task",
    });
  }
});


// ==========================================
// DELETE TASK
// ==========================================

app.delete(
  "/tasks/:id",
  authenticateToken,
  async (request, response) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      const result = await db.run(
        `
        DELETE FROM tasks
        WHERE id = ? AND userId = ?
        `,
        [id, userId]
      );

      if (result.changes === 0) {
        return response.status(404).send({
          message: "Task not found or unauthorized",
        });
      }

      response.send({
        message: "Task Deleted Successfully",
      });

    } catch (error) {
      console.log(error);

      response.status(500).send({
        message: "Failed to delete task",
      });
    }
  }
);


// ==========================================
// UPDATE TASK
// ==========================================

app.put(
  "/tasks/:id",
  authenticateToken,
  async (request, response) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      const {
        task,
        completed,
        favorite,
        priority,
        dueDate,
      } = request.body;

      if (!task || task.trim() === "") {
        return response.status(400).send({
          message: "Task is required",
        });
      }

      const result = await db.run(
        `
        UPDATE tasks
        SET
          task = ?,
          completed = ?,
          favorite = ?,
          priority = ?,
          dueDate = ?
        WHERE id = ? AND userId = ?
        `,
        [
          task.trim(),
          completed ? 1 : 0,
          favorite ? 1 : 0,
          priority || "Medium",
          dueDate || null,
          id,
          userId,
        ]
      );

      if (result.changes === 0) {
        return response.status(404).send({
          message: "Task not found or unauthorized",
        });
      }

      response.send({
        message: "Task Updated Successfully",
      });

    } catch (error) {
      console.log(error);

      response.status(500).send({
        message: "Failed to update task",
      });
    }
  }
);


// ==========================================
// START SERVER
// ==========================================

const startServer = async () => {
  try {
    db = await initializeDB();


    // USERS TABLE
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);


    // TASKS TABLE
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        favorite INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'Medium',
        dueDate TEXT,
        createdAt TEXT,
        userId INTEGER,
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `);


    console.log("✅ Database tables ready");

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`🚀 Server Running on Port ${PORT}`);
    });

  } catch (error) {
    console.log("❌ Database Error:", error);
  }
};

startServer();