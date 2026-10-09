import { useState } from "react";
import { toast } from "react-toastify";

function TaskList({ tasks = [], getTasks }) {
  const [editingId, setEditingId] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);

  const [editTask, setEditTask] = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const API_URL = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api"
  ).replace(/\/+$/, "");

  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  function openDeleteModal(taskItem) {
    setTaskToDelete(taskItem);
  }

  function closeDeleteModal() {
    setTaskToDelete(null);
  }

  // Shared API response handling
  async function sendRequest(url, options, fallbackMessage) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
      return null;
    }

    if (!response.ok) {
      throw new Error(
        data.message || data.error || fallbackMessage
      );
    }

    return data;
  }

  // DELETE TASK
  async function deleteTask() {
    if (!taskToDelete || saving) return;

    setSaving(true);

    try {
      const data = await sendRequest(
        `${API_URL}/tasks/${taskToDelete.id}`,
        {
          method: "DELETE",
          headers,
        },
        "Failed to delete task."
      );

      if (!data) return;

      toast.success("Task deleted successfully! 🗑️");
      setTaskToDelete(null);

      if (getTasks) await getTasks();
    } catch (error) {
      console.error("Delete task error:", error);
      toast.error(error.message || "Unable to delete task.");
    } finally {
      setSaving(false);
    }
  }

  // START EDITING
  function startEditing(taskItem) {
    setEditingId(taskItem.id);
    setEditTask(taskItem.task || "");
    setEditPriority(taskItem.priority || "Medium");
    setEditDueDate(
      taskItem.dueDate
        ? String(taskItem.dueDate).slice(0, 10)
        : ""
    );
  }

  // CANCEL EDITING
  function cancelEditing() {
    setEditingId(null);
    setEditTask("");
    setEditPriority("Medium");
    setEditDueDate("");
  }

  // SAVE TASK
  async function saveTask(taskItem) {
    if (!editTask.trim()) {
      toast.warning("Please enter a task!");
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      const data = await sendRequest(
        `${API_URL}/tasks/${taskItem.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            task: editTask.trim(),
            completed: Boolean(taskItem.completed),
            favorite: Boolean(taskItem.favorite),
            priority: editPriority,
            dueDate: editDueDate || null,
          }),
        },
        "Failed to update task."
      );

      if (!data) return;

      toast.success("Task updated successfully! ✏️");
      cancelEditing();

      if (getTasks) await getTasks();
    } catch (error) {
      console.error("Save task error:", error);
      toast.error(error.message || "Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  // TOGGLE COMPLETED
  async function toggleCompleted(taskItem) {
    if (saving) return;

    const nextCompleted = !Boolean(taskItem.completed);

    setSaving(true);

    try {
      const data = await sendRequest(
        `${API_URL}/tasks/${taskItem.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            task: taskItem.task,
            completed: nextCompleted,
            favorite: Boolean(taskItem.favorite),
            priority: taskItem.priority || "Medium",
            dueDate: taskItem.dueDate || null,
          }),
        },
        "Failed to update task."
      );

      if (!data) return;

      toast.success(
        nextCompleted
          ? "Task completed! 🎉"
          : "Task marked as active 🔄"
      );

      if (getTasks) await getTasks();
    } catch (error) {
      console.error("Toggle task error:", error);
      toast.error(error.message || "Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  // TOGGLE FAVORITE
  async function toggleFavorite(taskItem) {
    if (saving) return;

    const nextFavorite = !Boolean(taskItem.favorite);

    setSaving(true);

    try {
      const data = await sendRequest(
        `${API_URL}/tasks/${taskItem.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            task: taskItem.task,
            completed: Boolean(taskItem.completed),
            favorite: nextFavorite,
            priority: taskItem.priority || "Medium",
            dueDate: taskItem.dueDate || null,
          }),
        },
        "Failed to update favorite."
      );

      if (!data) return;

      toast.success(
        nextFavorite
          ? "Added to favorites ⭐"
          : "Removed from favorites."
      );

      if (getTasks) await getTasks();
    } catch (error) {
      console.error("Favorite update error:", error);
      toast.error(error.message || "Unable to update favorite.");
    } finally {
      setSaving(false);
    }
  }

  function getPriorityClass(priority) {
    if (priority === "High") return "high";
    if (priority === "Low") return "low";
    return "medium";
  }

  return (
    <>
      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No tasks found</h3>
            <p>Add a new task to get started!</p>
          </div>
        ) : (
          tasks.map((taskItem) => (
            <div
              className={`task-item ${
                Boolean(taskItem.completed) ? "completed" : ""
              }`}
              key={taskItem.id}
            >
              {editingId === taskItem.id ? (
                <div className="edit-form">
                  <div className="edit-form-row">
                    <div className="form-field">
                      <label htmlFor={`edit-task-${taskItem.id}`}>
                        Task
                      </label>

                      <input
                        id={`edit-task-${taskItem.id}`}
                        className="edit-input"
                        type="text"
                        maxLength={500}
                        value={editTask}
                        disabled={saving}
                        onChange={(event) =>
                          setEditTask(event.target.value)
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor={`edit-priority-${taskItem.id}`}>
                        Priority
                      </label>

                      <select
                        id={`edit-priority-${taskItem.id}`}
                        className="edit-select"
                        value={editPriority}
                        disabled={saving}
                        onChange={(event) =>
                          setEditPriority(event.target.value)
                        }
                      >
                        <option value="High">🔴 High</option>
                        <option value="Medium">🟡 Medium</option>
                        <option value="Low">🟢 Low</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label htmlFor={`edit-date-${taskItem.id}`}>
                        Due Date
                      </label>

                      <input
                        id={`edit-date-${taskItem.id}`}
                        className="edit-date"
                        type="date"
                        value={editDueDate}
                        disabled={saving}
                        onChange={(event) =>
                          setEditDueDate(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="edit-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={saving}
                      onClick={() => saveTask(taskItem)}
                    >
                      {saving ? "Saving..." : "💾 Save"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={saving}
                      onClick={cancelEditing}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    className="task-checkbox"
                    type="checkbox"
                    aria-label={`Mark ${taskItem.task} as ${
                      taskItem.completed ? "incomplete" : "completed"
                    }`}
                    checked={Boolean(taskItem.completed)}
                    disabled={saving}
                    onChange={() => toggleCompleted(taskItem)}
                  />

                  <div className="task-content">
                    <h3 className="task-title">
                      {taskItem.task}
                    </h3>

                    <div className="task-meta">
                      <span
                        className={`priority-badge ${getPriorityClass(
                          taskItem.priority
                        )}`}
                      >
                        {taskItem.priority === "High" && "🔴 "}
                        {taskItem.priority === "Medium" && "🟡 "}
                        {taskItem.priority === "Low" && "🟢 "}
                        {taskItem.priority || "Medium"}
                      </span>

                      <span className="due-date">
                        📅{" "}
                        {taskItem.dueDate
                          ? String(taskItem.dueDate).slice(0, 10)
                          : "No Due Date"}
                      </span>
                    </div>
                  </div>

                  <div className="task-actions">
                    <button
                      type="button"
                      className={`favorite-btn ${
                        taskItem.favorite ? "is-favorite" : ""
                      }`}
                      aria-label={
                        taskItem.favorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      title={
                        taskItem.favorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      disabled={saving}
                      onClick={() => toggleFavorite(taskItem)}
                    >
                      {taskItem.favorite ? "★" : "☆"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={saving}
                      onClick={() => startEditing(taskItem)}
                    >
                      ✏️ Edit
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={saving}
                      onClick={() => openDeleteModal(taskItem)}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {taskToDelete && (
        <div
          className="delete-modal-overlay"
          onClick={closeDeleteModal}
        >
          <div
            className="delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="delete-modal-icon">🗑️</div>

            <h2 id="delete-modal-title">Delete Task?</h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>"{taskToDelete.task}"</strong>?
            </p>

            <p className="delete-warning">
              This action cannot be undone.
            </p>

            <div className="delete-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={closeDeleteModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={deleteTask}
              >
                {saving ? "Deleting..." : "🗑 Delete Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TaskList;