import { useState } from "react";
import { toast } from "react-toastify";

function TaskList({ tasks = [], getTasks }) {
  const [editingId, setEditingId] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);

  const [editTask, setEditTask] = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editDueDate, setEditDueDate] = useState("");

  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Get JWT Token
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // OPEN DELETE MODAL
  function openDeleteModal(taskItem) {
    setTaskToDelete(taskItem);
  }

  // CLOSE DELETE MODAL
  function closeDeleteModal() {
    setTaskToDelete(null);
  }

  // DELETE TASK
  async function deleteTask() {
    if (!taskToDelete) return;

    try {
      const response = await fetch(
        `${API_URL}/tasks/${taskToDelete.id}`,
        {
          method: "DELETE",
          headers,
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Task deleted successfully! 🗑️");
        setTaskToDelete(null);
        await getTasks();
      } else {
        toast.error(data.message || "Failed to delete task");
      }
    } catch (error) {
      console.error(error);
      toast.error("Server error while deleting task");
    }
  }

  // START EDITING
  function startEditing(taskItem) {
    setEditingId(taskItem.id);
    setEditTask(taskItem.task || "");
    setEditPriority(taskItem.priority || "Medium");
    setEditDueDate(taskItem.dueDate || "");
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

    try {
      const response = await fetch(
        `${API_URL}/tasks/${taskItem.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            task: editTask.trim(),
            completed: taskItem.completed ? 1 : 0,
            favorite: taskItem.favorite ? 1 : 0,
            priority: editPriority,
            dueDate: editDueDate || null,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Task updated successfully! ✏️");
        setEditingId(null);
        await getTasks();
      } else {
        toast.error(data.message || "Failed to update task");
      }
    } catch (error) {
      console.error(error);
      toast.error("Server error while saving task");
    }
  }

  // TOGGLE COMPLETED
  async function toggleCompleted(taskItem) {
    try {
      const response = await fetch(
        `${API_URL}/tasks/${taskItem.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            task: taskItem.task,
            completed: taskItem.completed ? 0 : 1,
            favorite: taskItem.favorite ? 1 : 0,
            priority: taskItem.priority || "Medium",
            dueDate: taskItem.dueDate || null,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        if (taskItem.completed) {
          toast.info("Task marked as active 🔄");
        } else {
          toast.success("Task completed! 🎉");
        }

        await getTasks();
      } else {
        toast.error(data.message || "Failed to update task");
      }
    } catch (error) {
      console.error(error);
      toast.error("Server error while updating task");
    }
  }

  // TOGGLE FAVORITE
  async function toggleFavorite(taskItem) {
    try {
      const response = await fetch(
        `${API_URL}/tasks/${taskItem.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            task: taskItem.task,
            completed: taskItem.completed ? 1 : 0,
            favorite: taskItem.favorite ? 0 : 1,
            priority: taskItem.priority || "Medium",
            dueDate: taskItem.dueDate || null,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        if (taskItem.favorite) {
          toast.info("Removed from favorites");
        } else {
          toast.success("Added to favorites ⭐");
        }

        await getTasks();
      } else {
        toast.error(data.message || "Failed to update favorite");
      }
    } catch (error) {
      console.error(error);
      toast.error("Server error while updating favorite");
    }
  }

  // PRIORITY CLASS
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
                taskItem.completed ? "completed" : ""
              }`}
              key={taskItem.id}
            >
              {/* EDIT MODE */}
              {editingId === taskItem.id ? (
                <div className="edit-form">
                  <div className="edit-form-row">
                    <div className="form-field">
                      <label>Task</label>
                      <input
                        className="edit-input"
                        type="text"
                        value={editTask}
                        onChange={(e) =>
                          setEditTask(e.target.value)
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Priority</label>
                      <select
                        className="edit-select"
                        value={editPriority}
                        onChange={(e) =>
                          setEditPriority(e.target.value)
                        }
                      >
                        <option value="High">🔴 High</option>
                        <option value="Medium">🟡 Medium</option>
                        <option value="Low">🟢 Low</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Due Date</label>
                      <input
                        className="edit-date"
                        type="date"
                        value={editDueDate}
                        onChange={(e) =>
                          setEditDueDate(e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="edit-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => saveTask(taskItem)}
                    >
                      💾 Save
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={cancelEditing}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* CHECKBOX */}
                  <input
                    className="task-checkbox"
                    type="checkbox"
                    checked={Boolean(taskItem.completed)}
                    onChange={() => toggleCompleted(taskItem)}
                  />

                  {/* TASK CONTENT */}
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
                          ? taskItem.dueDate
                          : "No Due Date"}
                      </span>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="task-actions">
                    <button
                      className={`favorite-btn ${
                        taskItem.favorite ? "is-favorite" : ""
                      }`}
                      onClick={() => toggleFavorite(taskItem)}
                      title="Favorite"
                    >
                      {taskItem.favorite ? "★" : "☆"}
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => startEditing(taskItem)}
                    >
                      ✏️ Edit
                    </button>

                    <button
                      className="btn btn-danger btn-sm"
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

      {/* DELETE MODAL */}
      {taskToDelete && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <div className="delete-modal-icon">🗑️</div>

            <h2>Delete Task?</h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>"{taskToDelete.task}"</strong>?
            </p>

            <p className="delete-warning">
              This action cannot be undone.
            </p>

            <div className="delete-modal-actions">
              <button
                className="btn btn-secondary"
                onClick={closeDeleteModal}
              >
                Cancel
              </button>

              <button
                className="btn btn-danger"
                onClick={deleteTask}
              >
                🗑 Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TaskList;