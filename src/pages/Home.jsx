import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaSignOutAlt,
  FaStar,
  FaThLarge,
  FaPlus,
  FaBars,
  FaTimes,
  FaCalendarAlt,
} from "react-icons/fa";

import { toast } from "react-toastify";

import AddTask from "../components/AddTask";
import SearchBar from "../components/SearchBar";
import TaskList from "../components/TaskList";
import ProgressBar from "../components/ProgressBar";

function Home({ darkMode, setDarkMode }) {
  const navigate = useNavigate();

  // API configuration
  const API_URL = (
    import.meta.env.VITE_API_URL || "http://localhost:5000/api"
  ).replace(/\/+$/, "");

  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get the user's name
  const getUserName = () => {
    try {
      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        const user = JSON.parse(storedUser);
        return user.name || user.username || "My Account";
      }
    } catch (error) {
      console.error("Could not read user profile:", error);
    }

    return "My Account";
  };

  const userName = getUserName();

  // Authentication headers
  const getAuthHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  // Normalize task data from the backend
  const normalizeTask = (task) => ({
    ...task,
    completed:
      task.completed === true ||
      Number(task.completed) === 1
        ? 1
        : 0,
    favorite:
      task.favorite === true ||
      Number(task.favorite) === 1
        ? 1
        : 0,
    priority: task.priority || "Medium",
    dueDate: task.dueDate || "",
  });

  // Load tasks from the backend
  const getTasks = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setTasks([]);
      setLoading(false);
      navigate("/login", { replace: true });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Expired or invalid authentication
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setTasks([]);
        navigate("/login", { replace: true });
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch tasks.");
      }

      // Support both an array response and { success, tasks }
      const taskData = Array.isArray(data)
        ? data
        : Array.isArray(data.tasks)
          ? data.tasks
          : [];

      setTasks(taskData.map(normalizeTask));
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error(error.message || "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [API_URL, navigate]);

  useEffect(() => {
    getTasks();
  }, [getTasks]);

  // Dashboard statistics
  const totalTasks = tasks.length;

  const completedTasks = tasks.filter(
    (task) => Number(task.completed) === 1
  ).length;

  const activeTasks = totalTasks - completedTasks;

  const overdueTasks = tasks.filter((task) => {
    if (Number(task.completed) === 1 || !task.dueDate) {
      return false;
    }

    const dueDate = new Date(task.dueDate);

    if (Number.isNaN(dueDate.getTime())) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  }).length;

  const favoriteTasks = tasks.filter(
    (task) => Number(task.favorite) === 1
  ).length;

  const completionPercentage =
    totalTasks === 0
      ? 0
      : Math.round((completedTasks / totalTasks) * 100);

  // Handle API errors consistently
  async function handleTaskResponse(response, fallbackMessage) {
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setTasks([]);
      navigate("/login", { replace: true });
      return false;
    }

    if (!response.ok) {
      throw new Error(data.message || fallbackMessage);
    }

    return true;
  }

  // Delete a task
  async function deleteTask(id) {
    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const success = await handleTaskResponse(
        response,
        "Failed to delete task."
      );

      if (!success) return;

      setTasks((previousTasks) =>
        previousTasks.filter(
          (task) => String(task.id) !== String(id)
        )
      );

      toast.success("Task deleted successfully!");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error.message || "Unable to delete task.");
    }
  }

  // Complete or reactivate a task
  async function toggleTask(id) {
    const selectedTask = tasks.find(
      (task) => String(task.id) === String(id)
    );

    if (!selectedTask) return;

    const nextCompleted = Number(selectedTask.completed) !== 1;

    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          task: selectedTask.task,
          completed: nextCompleted,
          favorite: Number(selectedTask.favorite) === 1,
          priority: selectedTask.priority || "Medium",
          dueDate: selectedTask.dueDate || null,
        }),
      });

      const success = await handleTaskResponse(
        response,
        "Failed to update task."
      );

      if (!success) return;

      setTasks((previousTasks) =>
        previousTasks.map((task) =>
          String(task.id) === String(id)
            ? {
                ...task,
                completed: nextCompleted ? 1 : 0,
              }
            : task
        )
      );

      toast.success(
        nextCompleted
          ? "Task completed! 🎉"
          : "Task marked as active."
      );
    } catch (error) {
      console.error("Toggle complete error:", error);
      toast.error(error.message || "Unable to update task.");
    }
  }

  // Add or remove a favorite
  async function toggleFavorite(id) {
    const selectedTask = tasks.find(
      (task) => String(task.id) === String(id)
    );

    if (!selectedTask) return;

    const nextFavorite = Number(selectedTask.favorite) !== 1;

    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          task: selectedTask.task,
          completed: Number(selectedTask.completed) === 1,
          favorite: nextFavorite,
          priority: selectedTask.priority || "Medium",
          dueDate: selectedTask.dueDate || null,
        }),
      });

      const success = await handleTaskResponse(
        response,
        "Failed to update favorite."
      );

      if (!success) return;

      setTasks((previousTasks) =>
        previousTasks.map((task) =>
          String(task.id) === String(id)
            ? {
                ...task,
                favorite: nextFavorite ? 1 : 0,
              }
            : task
        )
      );

      toast.success(
        nextFavorite
          ? "Added to favorites ⭐"
          : "Removed from favorites."
      );
    } catch (error) {
      console.error("Favorite error:", error);
      toast.error(error.message || "Unable to update favorite.");
    }
  }

  // Logout
  const handleLogout = () => {
    setShowLogoutModal(false);

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setTasks([]);

    navigate("/login", { replace: true });
  };

  // Change the current workspace view
  const changeView = (view) => {
    setActiveView(view);
    setSidebarOpen(false);
  };

  // Display favorite tasks when Favorites is selected
  const displayedTasks =
    activeView === "favorites"
      ? tasks.filter((task) => Number(task.favorite) === 1)
      : tasks;

  // Current date
  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={`workspace ${darkMode ? "workspace-dark" : ""}`}>
      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div
          className="logout-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="logout-modal-icon">
              <FaSignOutAlt />
            </div>

            <h2 id="logout-modal-title">Sign out of TaskFlow?</h2>

            <p>
              Are you sure you want to sign out of your account?
            </p>

            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-cancel-btn"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="logout-confirm-btn"
                onClick={handleLogout}
              >
                <FaSignOutAlt />
                Yes, Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu backdrop */}
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`workspace-sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="workspace-brand">
          <div className="workspace-brand-icon">
            <FaTasks />
          </div>

          <div>
            <h2>TaskFlow</h2>
            <span>PRODUCTIVITY WORKSPACE</span>
          </div>

          <button
            className="sidebar-close"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <FaTimes />
          </button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="workspace-nav">
          <button
            className={`workspace-nav-link ${
              activeView === "dashboard" ? "active" : ""
            }`}
            onClick={() => changeView("dashboard")}
          >
            <FaThLarge />
            <span>Dashboard</span>
          </button>

          <button
            className={`workspace-nav-link ${
              activeView === "tasks" ? "active" : ""
            }`}
            onClick={() => changeView("tasks")}
          >
            <FaTasks />
            <span>My Tasks</span>
            <span className="nav-count">{activeTasks}</span>
          </button>

          <button
            className={`workspace-nav-link ${
              activeView === "favorites" ? "active" : ""
            }`}
            onClick={() => changeView("favorites")}
          >
            <FaStar />
            <span>Favorites</span>
            <span className="nav-count">{favoriteTasks}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-progress">
            <div className="sidebar-progress-heading">
              <span>Weekly progress</span>
              <strong>{completionPercentage}%</strong>
            </div>

            <div className="sidebar-progress-track">
              <div
                className="sidebar-progress-fill"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            <p>Keep making progress.</p>
          </div>

          <button
            type="button"
            className="sidebar-logout"
            onClick={() => setShowLogoutModal(true)}
          >
            <FaSignOutAlt />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="workspace-main">
        {/* Top navigation */}
        <header className="workspace-topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <FaBars />
            </button>

            <div>
              <span className="topbar-breadcrumb">
                WORKSPACE /{" "}
                {activeView === "favorites"
                  ? "FAVORITES"
                  : activeView === "tasks"
                    ? "MY TASKS"
                    : "DASHBOARD"}
              </span>

              <h2>
                {activeView === "favorites"
                  ? "Favorites"
                  : activeView === "tasks"
                    ? "My Tasks"
                    : "Dashboard"}
              </h2>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="workspace-theme-button"
              onClick={() => setDarkMode((previous) => !previous)}
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              title={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {darkMode ? "☀️" : "☾"}
            </button>

            <div className="workspace-profile">
              <div className="workspace-avatar">
                {userName.charAt(0).toUpperCase()}
              </div>

              <div className="workspace-profile-info">
                <strong>{userName}</strong>
                <span>Personal account</span>
              </div>
            </div>
          </div>
        </header>

        <div className="workspace-content">
          {/* Dashboard welcome */}
          {activeView === "dashboard" && (
            <section className="workspace-welcome">
              <div>
                <span className="workspace-date">
                  <FaCalendarAlt /> {formattedDate}
                </span>

                <h1>Good to see you, {userName}.</h1>

                <p>
                  Here's an overview of your tasks and progress.
                </p>
              </div>

              <button
                className="workspace-primary-button"
                onClick={() => setShowAddTask((previous) => !previous)}
              >
                <FaPlus />
                {showAddTask ? "Close form" : "New task"}
              </button>
            </section>
          )}

          {/* Dashboard statistics */}
          {activeView === "dashboard" && (
            <section className="workspace-stat-grid">
              <article className="workspace-stat-card">
                <div className="workspace-stat-top">
                  <span>Total tasks</span>
                  <div className="workspace-stat-icon neutral">
                    <FaTasks />
                  </div>
                </div>

                <strong>{totalTasks}</strong>
                <p>Tasks in your workspace</p>
              </article>

              <article className="workspace-stat-card">
                <div className="workspace-stat-top">
                  <span>Completed</span>
                  <div className="workspace-stat-icon green">
                    <FaCheckCircle />
                  </div>
                </div>

                <strong>{completedTasks}</strong>
                <p>{completionPercentage}% completion rate</p>
              </article>

              <article className="workspace-stat-card">
                <div className="workspace-stat-top">
                  <span>In progress</span>
                  <div className="workspace-stat-icon blue">
                    <FaClock />
                  </div>
                </div>

                <strong>{activeTasks}</strong>
                <p>Tasks left to complete</p>
              </article>

              <article className="workspace-stat-card">
                <div className="workspace-stat-top">
                  <span>Overdue</span>
                  <div className="workspace-stat-icon red">
                    <FaExclamationTriangle />
                  </div>
                </div>

                <strong>{overdueTasks}</strong>
                <p>Tasks past their due date</p>
              </article>
            </section>
          )}

          {/* Create task */}
          {(activeView === "dashboard" || activeView === "tasks") &&
            showAddTask && (
              <section className="workspace-panel workspace-add-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <h3>Create a task</h3>
                    <p>Add a task to your workspace.</p>
                  </div>

                  <button
                    className="workspace-icon-button"
                    onClick={() => setShowAddTask(false)}
                    aria-label="Close task form"
                  >
                    <FaTimes />
                  </button>
                </div>

                <AddTask
                  tasks={tasks}
                  getTasks={getTasks}
                />
              </section>
            )}

          {/* Task search and list */}
          <section className="workspace-panel workspace-search-panel">
            <div className="workspace-panel-heading">
              <div>
                <h3>
                  {activeView === "favorites"
                    ? "Your favorite tasks"
                    : activeView === "tasks"
                      ? "All your tasks"
                      : "Task overview"}
                </h3>

                <p>
                  {activeView === "favorites"
                    ? "Tasks you've marked as favorites."
                    : "Search, filter, and manage your tasks."}
                </p>
              </div>

              {(activeView === "tasks" || activeView === "dashboard") && (
                <button
                  className="workspace-secondary-button"
                  onClick={() => setShowAddTask((previous) => !previous)}
                >
                  <FaPlus />
                  Add task
                </button>
              )}
            </div>

            <div className="workspace-search">
              <SearchBar
                search={search}
                setSearch={setSearch}
              />
            </div>

            {loading ? (
              <p className="task-loading-message">Loading your tasks...</p>
            ) : (
              <TaskList
                tasks={displayedTasks}
                getTasks={getTasks}
                search={search}
                setSearch={setSearch}
                filter={filter}
                setFilter={setFilter}
                priorityFilter={priorityFilter}
                setPriorityFilter={setPriorityFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
                deleteTask={deleteTask}
                toggleTask={toggleTask}
                toggleFavorite={toggleFavorite}
              />
            )}
          </section>

          {/* Dashboard progress */}
          {activeView === "dashboard" && (
            <section className="workspace-panel workspace-progress-panel">
              <div className="workspace-panel-heading">
                <div>
                  <h3>Productivity</h3>
                  <p>Your overall task completion progress.</p>
                </div>

                <span className="workspace-progress-value">
                  {completionPercentage}%
                </span>
              </div>

              <ProgressBar
                total={totalTasks}
                completed={completedTasks}
              />
            </section>
          )}

          {/* Footer */}
          <footer className="workspace-footer">
            <span>TaskFlow Workspace</span>
            <span>Stay focused. Make progress.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default Home;