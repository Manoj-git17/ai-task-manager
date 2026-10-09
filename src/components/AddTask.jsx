import { useState } from "react";

function AddTask({ tasks, getTasks }) {
  const [task, setTask] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function showMessage(text) {
    setMessage(text);
    setError("");

    setTimeout(() => {
      setMessage("");
    }, 3000);
  }

  function showError(text) {
    setError(text);
    setMessage("");
  }

  async function addTask() {
    if (task.trim() === "") {
      showError("⚠️ Please enter a task.");
      return;
    }

    const taskExists = tasks.some(
      (item) =>
        item.task.toLowerCase().trim() ===
        task.toLowerCase().trim()
    );

    if (taskExists) {
      showError("⚠️ Task already exists!");
      return;
    }

    // GET TOKEN
    const token = localStorage.getItem("token");

    if (!token) {
      showError("❌ Please login again.");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:3000/tasks",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            task,
            priority,
            dueDate: dueDate || null,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        showMessage("✅ Task added successfully!");

        await getTasks();

        setTask("");
        setPriority("Medium");
        setDueDate("");

      } else {
        showError(
          data.message || "❌ Failed to add task."
        );
      }

    } catch (error) {
      console.log(error);

      showError("❌ Server Error");
    }
  }

  return (
    <div className="add-task-form">

      {message && (
        <p className="form-success">
          {message}
        </p>
      )}

      {error && (
        <p className="form-error">
          {error}
        </p>
      )}

      <div className="form-row">

        <div className="form-field">
          <label>Task Title</label>

          <input
            className="task-input"
            type="text"
            placeholder="Enter your task..."
            value={task}
            onChange={(e) => {
              setTask(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addTask();
              }
            }}
          />
        </div>


        <div className="form-field">
          <label>Priority</label>

          <select
            className="priority-select"
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value)
            }
          >
            <option value="High">
              🔴 High
            </option>

            <option value="Medium">
              🟡 Medium
            </option>

            <option value="Low">
              🟢 Low
            </option>
          </select>
        </div>


        <div className="form-field">
          <label>Due Date</label>

          <input
            className="date-input"
            type="date"
            value={dueDate}
            onChange={(e) =>
              setDueDate(e.target.value)
            }
          />
        </div>


        <div
          className="form-field"
          style={{ flex: "0 0 auto" }}
        >
          <label>&nbsp;</label>

          <button
            className="btn btn-primary"
            onClick={addTask}
          >
            ➕ Add Task
          </button>
        </div>

      </div>
    </div>
  );
}

export default AddTask;