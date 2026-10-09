import { useState } from "react";

function AddTask({ tasks = [], getTasks }) {
  const [task, setTask] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const API_URL = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api"
  ).replace(/\/+$/, "");

  function showMessage(text) {
    setMessage(text);
    setError("");
  }

  function showError(text) {
    setError(text);
    setMessage("");
  }

  async function addTask() {
    const trimmedTask = task.trim();

    if (!trimmedTask) {
      showError("Please enter a task.");
      return;
    }

    const taskExists = tasks.some(
      (item) =>
        item.task?.toLowerCase().trim() ===
        trimmedTask.toLowerCase()
    );

    if (taskExists) {
      showError("This task already exists!");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      showError("Your session has expired. Please log in again.");
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task: trimmedTask,
          priority,
          dueDate: dueDate || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        showError("Your session has expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            `Could not add task (HTTP ${response.status}).`
        );
      }

      showMessage("Task added successfully!");

      setTask("");
      setPriority("Medium");
      setDueDate("");

      if (typeof getTasks === "function") {
        await getTasks();
      }
    } catch (err) {
      console.error("Add task failed:", err);

      if (err instanceof TypeError) {
        showError(
          `Cannot connect to the backend at ${API_URL}. Check that your backend is running.`
        );
      } else {
        showError(err.message || "Unable to add task.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="add-task-form">
      {message && (
        <p className="form-success" role="status">
          ✅ {message}
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          ❌ {error}
        </p>
      )}

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="task-title">Task Title</label>

          <input
            id="task-title"
            className="task-input"
            type="text"
            placeholder="Enter your task..."
            value={task}
            maxLength={200}
            disabled={submitting}
            onChange={(event) => {
              setTask(event.target.value);
              setError("");
              setMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTask();
              }
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="task-priority">Priority</label>

          <select
            id="task-priority"
            className="priority-select"
            value={priority}
            disabled={submitting}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="High">🔴 High</option>
            <option value="Medium">🟡 Medium</option>
            <option value="Low">🟢 Low</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="task-due-date">Due Date</label>

          <input
            id="task-due-date"
            className="date-input"
            type="date"
            value={dueDate}
            disabled={submitting}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>

        <div className="form-field add-task-button-field">
          <label aria-hidden="true">&nbsp;</label>

          <button
            type="button"
            className="btn btn-primary"
            onClick={addTask}
            disabled={submitting}
          >
            {submitting ? "Adding..." : "➕ Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddTask;