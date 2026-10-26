import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { notifyTaskToggle } from "../utils/toastNotifications";
import {
  FiStar,
  FiCalendar,
  FiTrash2,
  FiEdit3,
  FiZap,
  FiCheck,
  FiX,
  FiAlertTriangle,
  FiInbox,
  FiSave,
  FiPlus,
  FiRefreshCw,
  FiClock,
  FiLayers,
  FiCheckCircle,
} from "react-icons/fi";

function TaskList({
  tasks = [],
  getTasks,
  deleteTask: propDeleteTask,
  toggleTask: propToggleTask,
  toggleFavorite: propToggleFavorite,
  updateTask: propUpdateTask,
  search = "",
  filter = "all",
  priorityFilter = "all",
  loading = false,
  backendError = null,
  onRetry = null,
  workspaces = [],
}) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // AI Task Decomposition State
  const [breakdownTask, setBreakdownTask] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [addingSubtasks, setAddingSubtasks] = useState(false);

  const [editTask, setEditTask] = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [editWorkspace, setEditWorkspace] = useState("Engineering Core");
  const [saving, setSaving] = useState(false);

  // Grouping Mode ("day" | "flat")
  const [taskGrouping, setTaskGrouping] = useState("day");

  // Bulk Delete Modal State
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Day-Wise Specific Clear Modal State
  const [dayGroupToClear, setDayGroupToClear] = useState(null);
  const [clearingDayTasks, setClearingDayTasks] = useState(false);

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

  // AI Breakdown Handlers
  async function openBreakdownModal(taskItem) {
    setBreakdownTask(taskItem);
    setLoadingBreakdown(true);
    setSubtasks([]);

    try {
      const response = await fetch(`${API_URL}/ai/breakdown`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          task: taskItem.task || taskItem.title || "",
          priority: taskItem.priority || "Medium",
          dueDate: taskItem.dueDate || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      if (response.ok && data.success && Array.isArray(data.subtasks)) {
        setSubtasks(
          data.subtasks.map((s, idx) => ({
            id: `subtask-${idx}`,
            task: s.task,
            priority: s.priority || "Medium",
            dueDate: s.dueDate || "",
            selected: true,
          }))
        );
      } else {
        toast.error(data.message || "Failed to generate AI subtasks.");
        setBreakdownTask(null);
      }
    } catch (err) {
      console.error("AI breakdown error:", err);
      toast.error("Could not reach AI breakdown service.");
      setBreakdownTask(null);
    } finally {
      setLoadingBreakdown(false);
    }
  }

  function closeBreakdownModal() {
    setBreakdownTask(null);
    setSubtasks([]);
    setLoadingBreakdown(false);
    setAddingSubtasks(false);
  }

  function toggleSubtaskSelection(index) {
    setSubtasks((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  }

  async function addSelectedSubtasks() {
    const selectedList = subtasks.filter((s) => s.selected && s.task.trim());
    if (selectedList.length === 0) {
      toast.warning("Please select at least one subtask to add.");
      return;
    }

    setAddingSubtasks(true);

    try {
      for (const item of selectedList) {
        await fetch(`${API_URL}/tasks`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            task: item.task.trim(),
            priority: item.priority || "Medium",
            dueDate: item.dueDate || null,
          }),
        });
      }

      toast.success(`Added ${selectedList.length} subtasks to your workspace!`);
      closeBreakdownModal();

      if (typeof getTasks === "function") {
        await getTasks();
      }
    } catch (err) {
      console.error("Add subtasks error:", err);
      toast.error("Failed to add all subtasks.");
    } finally {
      setAddingSubtasks(false);
    }
  }

  // Shared API response handling
  async function sendRequest(url, options, fallbackMessage) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
      return null;
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || fallbackMessage);
    }

    return data;
  }

  // DELETE TASK
  async function deleteTask() {
    if (!taskToDelete || saving) return;

    setSaving(true);

    try {
      if (propDeleteTask) {
        await propDeleteTask(taskToDelete.id);
        setTaskToDelete(null);
        return;
      }

      const data = await sendRequest(
        `${API_URL}/tasks/${taskToDelete.id}`,
        {
          method: "DELETE",
          headers,
        },
        "Failed to delete task."
      );

      if (!data) return;

      toast.success("Task deleted successfully!");
      setTaskToDelete(null);

      if (getTasks) await getTasks();
    } catch (error) {
      console.error("Delete task error:", error);
      toast.error(error.message || "Unable to delete task.");
    } finally {
      setSaving(false);
    }
  }

  // DELETE ALL / CLEAR TASKS
  async function handleDeleteAllTasks(onlyCompleted = false) {
    if (deletingAll) return;
    setDeletingAll(true);

    try {
      const url = onlyCompleted
        ? `${API_URL}/tasks?status=completed`
        : `${API_URL}/tasks`;

      const response = await fetch(url, {
        method: "DELETE",
        headers,
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success(
          data.message ||
            (onlyCompleted
              ? "Completed tasks cleared."
              : "All tasks deleted successfully.")
        );
        setShowDeleteAllModal(false);
        if (getTasks) await getTasks();
      } else {
        toast.error(data.message || "Failed to clear tasks.");
      }
    } catch (err) {
      console.error("Delete all tasks error:", err);
      toast.error("Network error while trying to clear tasks.");
    } finally {
      setDeletingAll(false);
    }
  }

  // OPEN DAY-SPECIFIC CLEAR MODAL
  const handlePromptClearDayTasks = (group) => {
    if (!group || !Array.isArray(group.tasks) || group.tasks.length === 0) return;
    setDayGroupToClear(group);
  };

  // CONFIRM DAY-SPECIFIC CLEAR (ALL OR COMPLETED ONLY)
  async function handleConfirmClearDayTasks(onlyCompleted = false) {
    if (!dayGroupToClear || !Array.isArray(dayGroupToClear.tasks)) return;

    const targetTasks = onlyCompleted
      ? dayGroupToClear.tasks.filter((t) => Boolean(t.completed))
      : dayGroupToClear.tasks;

    if (targetTasks.length === 0) {
      toast.info(`No completed tasks to clear in ${dayGroupToClear.title}.`);
      return;
    }

    const taskIdsToDelete = targetTasks.map((t) => t.id);

    setClearingDayTasks(true);

    try {
      const response = await fetch(`${API_URL}/tasks/bulk-delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          taskIds: taskIdsToDelete,
          status: onlyCompleted ? "completed" : undefined,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success(
          onlyCompleted
            ? `Cleared ${targetTasks.length} completed task(s) from ${dayGroupToClear.title}.`
            : `Deleted all ${targetTasks.length} task(s) from ${dayGroupToClear.title}.`
        );
        setDayGroupToClear(null);
        if (getTasks) await getTasks();
      } else {
        toast.error(data.message || `Failed to clear tasks from ${dayGroupToClear.title}.`);
      }
    } catch (err) {
      console.error("Clear day tasks error:", err);
      toast.error("Network error while trying to clear tasks.");
    } finally {
      setClearingDayTasks(false);
    }
  }

  // START EDITING
  function startEditing(taskItem) {
    setEditingId(taskItem.id);
    setEditTask(taskItem.task || taskItem.title || "");
    setEditPriority(taskItem.priority || "Medium");
    setEditDueDate(
      taskItem.dueDate ? String(taskItem.dueDate).slice(0, 10) : ""
    );
    setEditWorkspace(taskItem.workspace || "Engineering Core");
  }

  // CANCEL EDITING
  function cancelEditing() {
    setEditingId(null);
    setEditTask("");
    setEditPriority("Medium");
    setEditDueDate("");
    setEditWorkspace("Engineering Core");
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
      if (propUpdateTask) {
        const ok = await propUpdateTask(taskItem.id, {
          task: editTask.trim(),
          priority: editPriority,
          dueDate: editDueDate || null,
          workspace: editWorkspace || taskItem.workspace || "Engineering Core",
        });
        if (ok) {
          cancelEditing();
        }
        return;
      }

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
            workspace: editWorkspace || taskItem.workspace || "Engineering Core",
          }),
        },
        "Failed to update task."
      );

      if (!data) return;

      toast.success("Task updated successfully!");
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

    if (propToggleTask) {
      setSaving(true);
      try {
        await propToggleTask(taskItem.id);
      } catch (error) {
        console.error("Toggle task error:", error);
      } finally {
        setSaving(false);
      }
      return;
    }

    const nextCompleted = !taskItem.completed;

    setSaving(true);

    try {
      const data = await sendRequest(
        `${API_URL}/tasks/${taskItem.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            task: taskItem.task || taskItem.title || "",
            completed: nextCompleted,
            favorite: Boolean(taskItem.favorite),
            priority: taskItem.priority || "Medium",
            dueDate: taskItem.dueDate || null,
          }),
        },
        "Failed to update task."
      );

      if (!data) return;

      notifyTaskToggle(taskItem.task || taskItem.title, nextCompleted);

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

    if (propToggleFavorite) {
      setSaving(true);
      try {
        await propToggleFavorite(taskItem.id);
      } catch (error) {
        console.error("Toggle favorite error:", error);
      } finally {
        setSaving(false);
      }
      return;
    }

    const nextFavorite = !taskItem.favorite;

    setSaving(true);

    try {
      const data = await sendRequest(
        `${API_URL}/tasks/${taskItem.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            task: taskItem.task || taskItem.title || "",
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
        nextFavorite ? "Added to favorites." : "Removed from favorites."
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

  // Linear-style relative date formatter
  function formatDueDate(dueDateStr, isCompleted) {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    if (Number.isNaN(due.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(due);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (isCompleted) {
      return {
        label: target.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        className: "due-completed",
      };
    }

    if (diffDays < 0) {
      return {
        label: `Overdue · ${Math.abs(diffDays)}d ago`,
        className: "due-overdue",
      };
    }
    if (diffDays === 0) {
      return {
        label: "Today",
        className: "due-today",
      };
    }
    if (diffDays === 1) {
      return {
        label: "Tomorrow",
        className: "due-tomorrow",
      };
    }
    if (diffDays <= 7) {
      return {
        label: `In ${diffDays} days`,
        className: "due-upcoming",
      };
    }

    return {
      label: target.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      className: "due-future",
    };
  }

  // Group tasks day-wise
  const groupedTasksByDay = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const groupsMap = new Map();

    const getBucket = (taskItem) => {
      const isDone = Boolean(taskItem.completed);
      if (isDone) {
        return {
          key: "completed",
          title: "Completed",
          subtitle: "Finished tasks",
          order: 9999,
          badgeClass: "badge-completed",
          iconType: "check",
        };
      }

      if (!taskItem.dueDate) {
        return {
          key: "no-date",
          title: "No Due Date",
          subtitle: "Backlog / Flexible",
          order: 9990,
          badgeClass: "badge-nodate",
          iconType: "inbox",
        };
      }

      const d = new Date(taskItem.dueDate);
      if (Number.isNaN(d.getTime())) {
        return {
          key: "no-date",
          title: "No Due Date",
          subtitle: "Backlog / Flexible",
          order: 9990,
          badgeClass: "badge-nodate",
          iconType: "inbox",
        };
      }

      const target = new Date(d);
      target.setHours(0, 0, 0, 0);

      const diffDays = Math.round(
        (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        return {
          key: "overdue",
          title: "Overdue",
          subtitle: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
          order: -100 + diffDays,
          badgeClass: "badge-overdue",
          iconType: "alert",
        };
      }

      if (diffDays === 0) {
        return {
          key: "today",
          title: "Today",
          subtitle: today.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          order: 0,
          badgeClass: "badge-today",
          iconType: "today",
        };
      }

      if (diffDays === 1) {
        return {
          key: "tomorrow",
          title: "Tomorrow",
          subtitle: target.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          order: 1,
          badgeClass: "badge-tomorrow",
          iconType: "tomorrow",
        };
      }

      const dateKey = target.toISOString().slice(0, 10);
      return {
        key: `date-${dateKey}`,
        title: target.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        }),
        subtitle: `In ${diffDays} days`,
        order: diffDays,
        badgeClass: "badge-upcoming",
        iconType: "calendar",
      };
    };

    for (const t of tasks) {
      const bucket = getBucket(t);
      if (!groupsMap.has(bucket.key)) {
        groupsMap.set(bucket.key, {
          ...bucket,
          tasks: [],
        });
      }
      groupsMap.get(bucket.key).tasks.push(t);
    }

    return Array.from(groupsMap.values()).sort((a, b) => a.order - b.order);
  }, [tasks]);

  // Renderer for single task item
  const renderTaskItem = (taskItem) => {
    const isCompleted = Boolean(taskItem.completed);
    const isFavorite = Boolean(taskItem.favorite);
    const title = taskItem.task || taskItem.title || "";
    const dueInfo = formatDueDate(taskItem.dueDate, isCompleted);

    return (
      <div
        className={`task-item ${isCompleted ? "completed" : ""}`}
        key={taskItem.id}
      >
        {editingId === taskItem.id ? (
          <div className="edit-form">
            <div className="edit-form-row">
              <div className="form-field title-field">
                <label htmlFor={`edit-task-${taskItem.id}`}>
                  Task Description
                </label>
                <input
                  id={`edit-task-${taskItem.id}`}
                  className="edit-input"
                  type="text"
                  maxLength={500}
                  value={editTask}
                  disabled={saving}
                  onChange={(e) => setEditTask(e.target.value)}
                />
              </div>

              <div className="form-field priority-field">
                <label htmlFor={`edit-priority-${taskItem.id}`}>
                  Priority
                </label>
                <select
                  id={`edit-priority-${taskItem.id}`}
                  className="edit-select"
                  value={editPriority}
                  disabled={saving}
                  onChange={(e) => setEditPriority(e.target.value)}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="form-field date-field">
                <label htmlFor={`edit-date-${taskItem.id}`}>
                  Due Date
                </label>
                <input
                  id={`edit-date-${taskItem.id}`}
                  className="edit-date"
                  type="date"
                  value={editDueDate}
                  disabled={saving}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>

              <div className="form-field workspace-field">
                <label htmlFor={`edit-workspace-${taskItem.id}`}>
                  Workspace
                </label>
                <select
                  id={`edit-workspace-${taskItem.id}`}
                  className="edit-select"
                  value={editWorkspace}
                  disabled={saving}
                  onChange={(e) => setEditWorkspace(e.target.value)}
                >
                  {workspaces.length > 0 ? (
                    workspaces.map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Engineering Core">Engineering Core</option>
                      <option value="Product Roadmap">Product Roadmap</option>
                      <option value="Personal Focus">Personal Focus</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="edit-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={saving}
                onClick={() => saveTask(taskItem)}
              >
                <FiSave aria-hidden="true" />
                <span>{saving ? "Saving..." : "Save Changes"}</span>
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
            {/* Custom Accessible Checkbox */}
            <button
              type="button"
              role="checkbox"
              aria-checked={isCompleted}
              className={`task-checkbox-custom ${
                isCompleted ? "checked is-checked" : ""
              }`}
              aria-label={`Mark "${title}" as ${
                isCompleted ? "incomplete" : "completed"
              }`}
              disabled={saving}
              onClick={() => toggleCompleted(taskItem)}
            >
              {isCompleted && <FiCheck className="check-svg" />}
            </button>

            <div className="task-content">
              <span className="task-title" title={title}>
                {title}
              </span>

              <div className="task-meta">
                {/* Priority Pill */}
                <span
                  className={`priority-badge ${getPriorityClass(
                    taskItem.priority
                  )}`}
                >
                  <span className="priority-dot" aria-hidden="true" />
                  <span>{taskItem.priority || "Medium"}</span>
                </span>

                {/* Due Date Indicator */}
                {dueInfo && (
                  <span
                    className={`due-date-pill ${dueInfo.className}`}
                  >
                    <FiCalendar aria-hidden="true" />
                    <span>{dueInfo.label}</span>
                  </span>
                )}

                {/* Workspace Tag */}
                {taskItem.workspace && (
                  <span className="tf-task-workspace-tag">
                    <FiLayers aria-hidden="true" />
                    <span>{taskItem.workspace}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Hover Actions Cluster */}
            <div className="task-actions">
              <button
                type="button"
                className={`favorite-btn ${
                  isFavorite ? "is-favorite" : ""
                }`}
                aria-label={
                  isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                title={
                  isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                disabled={saving}
                onClick={() => toggleFavorite(taskItem)}
              >
                <FiStar className="action-svg" />
              </button>

              <button
                type="button"
                className="action-icon-btn action-ai-breakdown"
                disabled={saving || loadingBreakdown}
                onClick={() => openBreakdownModal(taskItem)}
                title="AI Subtask Decomposition"
                aria-label="Deconstruct task into subtasks using AI"
              >
                <FiZap className="action-svg" />
              </button>

              <button
                type="button"
                className="action-icon-btn action-edit"
                disabled={saving}
                onClick={() => startEditing(taskItem)}
                title="Edit Task"
                aria-label={`Edit task ${title}`}
              >
                <FiEdit3 className="action-svg" />
              </button>

              <button
                type="button"
                className="action-icon-btn action-delete"
                disabled={saving}
                onClick={() => openDeleteModal(taskItem)}
                title="Delete Task"
                aria-label={`Delete task ${title}`}
              >
                <FiTrash2 className="action-svg" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="task-list">
        {backendError && tasks.length === 0 ? (
          <div className="empty-state tf-backend-error-state" role="alert">
            <div className="empty-state-icon error-icon" aria-hidden="true">
              <FiAlertTriangle />
            </div>
            <h3>Backend Connection Unavailable</h3>
            <p>{backendError}</p>
            {onRetry && (
              <button
                type="button"
                className="btn btn-primary tf-btn-retry"
                onClick={onRetry}
                disabled={loading}
              >
                <FiRefreshCw className={loading ? "spin" : ""} />
                <span>{loading ? "Connecting..." : "Retry Connection"}</span>
              </button>
            )}
          </div>
        ) : loading && tasks.length === 0 ? (
          <div className="tf-task-loading-container">
            <div className="tf-skeleton-card shimmer" />
            <div className="tf-skeleton-card shimmer" />
            <div className="tf-skeleton-card shimmer" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">
              <FiInbox />
            </div>
            <h3>
              {(search || "").trim() ||
              filter !== "all" ||
              priorityFilter !== "all"
                ? "No matching tasks found"
                : "All tasks completed"}
            </h3>
            <p>
              {(search || "").trim() ||
              filter !== "all" ||
              priorityFilter !== "all"
                ? "Try clearing your search query or switching your active filter status."
                : "You're caught up! Create a new task or plan your next milestone."}
            </p>
          </div>
        ) : (
          <>
            <div className="tf-tasklist-header-bar">
              <div className="tf-tasklist-header-left">
                <span className="tf-tasklist-total-count">
                  {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                </span>
              </div>
              <div className="tf-tasklist-header-right">
                <div className="tf-grouping-switcher" role="radiogroup" aria-label="Task grouping style">
                  <button
                    type="button"
                    className={`tf-btn-grouping ${taskGrouping === "day" ? "active" : ""}`}
                    onClick={() => setTaskGrouping("day")}
                    title="Group tasks day-wise by due date"
                  >
                    <FiCalendar aria-hidden="true" />
                    <span>Day-Wise</span>
                  </button>
                  <button
                    type="button"
                    className={`tf-btn-grouping ${taskGrouping === "flat" ? "active" : ""}`}
                    onClick={() => setTaskGrouping("flat")}
                    title="Show flat list"
                  >
                    <FiLayers aria-hidden="true" />
                    <span>Flat</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="tf-btn-clear-all"
                  onClick={() => setShowDeleteAllModal(true)}
                  title="Clear all tasks or completed tasks"
                  aria-label="Clear tasks"
                >
                  <FiTrash2 aria-hidden="true" />
                  <span>Clear Tasks</span>
                </button>
              </div>
            </div>

            {taskGrouping === "day" ? (
              groupedTasksByDay.map((group) => (
                <div key={group.key} className={`tf-day-group tf-day-${group.key}`}>
                  <div className="tf-day-header">
                    <div className="tf-day-header-left">
                      <div className={`tf-day-header-icon-wrap ${group.badgeClass}`}>
                        {group.iconType === "alert" && <FiAlertTriangle />}
                        {group.iconType === "today" && <FiClock />}
                        {group.iconType === "tomorrow" && <FiCalendar />}
                        {group.iconType === "calendar" && <FiCalendar />}
                        {group.iconType === "check" && <FiCheckCircle />}
                        {group.iconType === "inbox" && <FiLayers />}
                      </div>
                      <div className="tf-day-header-text">
                        <span className="tf-day-title">{group.title}</span>
                        <span className="tf-day-subtitle">{group.subtitle}</span>
                      </div>
                    </div>
                    <div className="tf-day-header-right">
                      <span className={`tf-day-count-badge ${group.badgeClass}`}>
                        {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}
                      </span>
                      <button
                        type="button"
                        className="tf-btn-clear-day"
                        onClick={() => handlePromptClearDayTasks(group)}
                        title={`Clear all tasks for ${group.title}`}
                        aria-label={`Clear all tasks for ${group.title}`}
                      >
                        <FiTrash2 className="tf-btn-clear-day-icon" />
                        <span>Clear Day</span>
                      </button>
                    </div>
                  </div>

                  <div className="tf-day-tasks-list">
                    {group.tasks.map(renderTaskItem)}
                  </div>
                </div>
              ))
            ) : (
              <div className="tf-flat-tasks-list">
                {tasks.map(renderTaskItem)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="delete-modal-overlay" onClick={closeDeleteModal}>
          <div
            className="delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-icon-wrap" aria-hidden="true">
              <FiAlertTriangle className="delete-icon" />
            </div>

            <h2 id="delete-modal-title">Delete Task?</h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>
                "{taskToDelete.task || taskToDelete.title || "this task"}"
              </strong>
              ?
            </p>

            <span className="delete-warning">This action cannot be undone.</span>

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
                <FiTrash2 aria-hidden="true" />
                <span>{saving ? "Deleting..." : "Delete Task"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All / Clear Tasks Confirmation Modal */}
      {showDeleteAllModal && (
        <div
          className="delete-modal-overlay"
          onClick={() => !deletingAll && setShowDeleteAllModal(false)}
        >
          <div
            className="delete-modal bulk-clear-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-tasks-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-header">
              <div className="delete-modal-icon-wrap" aria-hidden="true">
                <FiAlertTriangle className="delete-modal-icon" />
              </div>
              <h3 id="clear-tasks-modal-title">Clear Workspace Tasks</h3>
              <button
                type="button"
                className="delete-modal-close"
                onClick={() => !deletingAll && setShowDeleteAllModal(false)}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>

            <p>
              Choose whether to clear only finished milestones or remove all tasks in this workspace:
            </p>

            <div className="tf-clear-stats-summary">
              <div className="tf-clear-stat-pill">
                <span className="tf-stat-number">{tasks.length}</span>
                <span className="tf-stat-label">Total Tasks</span>
              </div>
              <div className="tf-clear-stat-pill completed">
                <span className="tf-stat-number">
                  {tasks.filter((t) => Boolean(t.completed)).length}
                </span>
                <span className="tf-stat-label">Completed</span>
              </div>
              <div className="tf-clear-stat-pill active">
                <span className="tf-stat-number">
                  {tasks.filter((t) => !t.completed).length}
                </span>
                <span className="tf-stat-label">Active</span>
              </div>
            </div>

            <span className="delete-warning">
              This action permanently deletes the selected tasks from the database.
            </span>

            <div className="delete-modal-actions bulk-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deletingAll}
                onClick={() => setShowDeleteAllModal(false)}
              >
                Cancel
              </button>

              {tasks.some((t) => Boolean(t.completed)) && (
                <button
                  type="button"
                  className="btn btn-warning tf-btn-modal-clear-completed"
                  disabled={deletingAll}
                  onClick={() => handleDeleteAllTasks(true)}
                >
                  {deletingAll ? "Clearing..." : "Clear Completed Only"}
                </button>
              )}

              <button
                type="button"
                className="btn btn-danger"
                disabled={deletingAll}
                onClick={() => handleDeleteAllTasks(false)}
              >
                <FiTrash2 aria-hidden="true" />
                <span>{deletingAll ? "Deleting..." : "Delete All Tasks"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day-Wise Clear Confirmation Modal */}
      {dayGroupToClear && (
        <div
          className="delete-modal-overlay"
          onClick={() => !clearingDayTasks && setDayGroupToClear(null)}
        >
          <div
            className="delete-modal bulk-clear-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-day-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-header">
              <div className="delete-modal-icon-wrap" aria-hidden="true">
                <FiAlertTriangle className="delete-modal-icon" />
              </div>
              <h3 id="clear-day-modal-title">Clear Tasks for {dayGroupToClear.title}</h3>
              <button
                type="button"
                className="delete-modal-close"
                onClick={() => !clearingDayTasks && setDayGroupToClear(null)}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>

            <p>
              You are about to clear tasks scheduled for{" "}
              <strong>{dayGroupToClear.title}</strong> ({dayGroupToClear.subtitle}). Choose an option below:
            </p>

            <div className="tf-clear-stats-summary">
              <div className="tf-clear-stat-pill">
                <span className="tf-stat-number">{dayGroupToClear.tasks.length}</span>
                <span className="tf-stat-label">Day Total</span>
              </div>
              <div className="tf-clear-stat-pill completed">
                <span className="tf-stat-number">
                  {dayGroupToClear.tasks.filter((t) => Boolean(t.completed)).length}
                </span>
                <span className="tf-stat-label">Completed</span>
              </div>
              <div className="tf-clear-stat-pill active">
                <span className="tf-stat-number">
                  {dayGroupToClear.tasks.filter((t) => !t.completed).length}
                </span>
                <span className="tf-stat-label">Active</span>
              </div>
            </div>

            <span className="delete-warning">
              This action permanently deletes the selected tasks for {dayGroupToClear.title}.
            </span>

            <div className="delete-modal-actions bulk-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={clearingDayTasks}
                onClick={() => setDayGroupToClear(null)}
              >
                Cancel
              </button>

              {dayGroupToClear.tasks.some((t) => Boolean(t.completed)) && (
                <button
                  type="button"
                  className="btn btn-warning tf-btn-modal-clear-completed"
                  disabled={clearingDayTasks}
                  onClick={() => handleConfirmClearDayTasks(true)}
                >
                  Clear Completed ({dayGroupToClear.tasks.filter((t) => Boolean(t.completed)).length})
                </button>
              )}

              <button
                type="button"
                className="btn btn-danger"
                disabled={clearingDayTasks}
                onClick={() => handleConfirmClearDayTasks(false)}
              >
                <FiTrash2 aria-hidden="true" />
                <span>
                  {clearingDayTasks ? "Deleting..." : `Delete All ${dayGroupToClear.title} Tasks`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Task Decomposition Modal */}
      {breakdownTask && (
        <div className="ai-modal-overlay" onClick={closeBreakdownModal}>
          <div
            className="ai-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ai-modal-header">
              <div className="ai-modal-icon-wrap" aria-hidden="true">
                <FiZap className="ai-modal-icon" />
              </div>
              <div className="ai-modal-title-block">
                <h3 id="ai-modal-title">AI Task Decomposition</h3>
                <p>
                  Deconstructing:{" "}
                  <strong>
                    "{breakdownTask.task || breakdownTask.title}"
                  </strong>
                </p>
              </div>
              <button
                type="button"
                className="ai-modal-close-btn"
                onClick={closeBreakdownModal}
                aria-label="Close decomposition modal"
              >
                <FiX />
              </button>
            </div>

            {loadingBreakdown ? (
              <div className="ai-modal-loading">
                <div className="ai-spinner" />
                <p>Generating actionable milestones & tactical subtasks...</p>
              </div>
            ) : (
              <div className="ai-subtasks-container">
                <p className="ai-subtasks-instruction">
                  Review and select which subtasks to integrate into your
                  workspace:
                </p>

                <div className="ai-subtasks-list">
                  {subtasks.map((sub, idx) => (
                    <label
                      key={sub.id}
                      className={`ai-subtask-row ${
                        sub.selected ? "selected" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={sub.selected}
                        onChange={() => toggleSubtaskSelection(idx)}
                      />
                      <div className="ai-subtask-info">
                        <span className="ai-subtask-title">{sub.task}</span>
                        <div className="ai-subtask-meta">
                          <span
                            className={`priority-badge ${getPriorityClass(
                              sub.priority
                            )}`}
                          >
                            <span
                              className="priority-dot"
                              aria-hidden="true"
                            />
                            <span>{sub.priority}</span>
                          </span>
                          {sub.dueDate && (
                            <span className="due-date-pill due-upcoming">
                              <FiCalendar aria-hidden="true" />
                              <span>{sub.dueDate}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="ai-modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={addingSubtasks}
                    onClick={closeBreakdownModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      addingSubtasks ||
                      subtasks.filter((s) => s.selected).length === 0
                    }
                    onClick={addSelectedSubtasks}
                  >
                    <FiPlus aria-hidden="true" />
                    <span>
                      {addingSubtasks
                        ? "Adding subtasks..."
                        : `Add ${
                            subtasks.filter((s) => s.selected).length
                          } Subtasks`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default TaskList;
