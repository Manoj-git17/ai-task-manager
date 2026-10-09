import { useState, useEffect, useCallback } from "react";

import {
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
} from "react-icons/fa";

import AddTask from "../components/AddTask";
import SearchBar from "../components/SearchBar";
import TaskList from "../components/TaskList";
import ProgressBar from "../components/ProgressBar";

function Home({ darkMode, setDarkMode }) {
  // =========================
  // API URL
  // =========================

  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

  // =========================
  // STATES
  // =========================

  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // =========================
  // GET AUTH TOKEN
  // =========================

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // =========================
  // GET TASKS FROM BACKEND
  // =========================

  const getTasks = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.log("No authentication token found");
        setTasks([]);
        return;
      }

      const response = await fetch(`${API_URL}/tasks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }

      const data = await response.json();

      const formattedTasks = data.map((task) => ({
        ...task,
        completed: Number(task.completed),
        favorite: Number(task.favorite),
        priority: task.priority || "Medium",
        dueDate: task.dueDate || "",
      }));

      setTasks(formattedTasks);
    } catch (error) {
      console.log("Error fetching tasks:", error);
    }
  }, [API_URL]);

  // =========================
  // LOAD TASKS
  // =========================

  useEffect(() => {
    getTasks();
  }, [getTasks]);

  // =========================
  // STATISTICS
  // =========================

  const totalTasks = tasks.length;

  const completedTasks = tasks.filter(
    (task) => Number(task.completed) === 1
  ).length;

  const activeTasks = totalTasks - completedTasks;

  // =========================
  // OVERDUE TASKS
  // =========================

  const overdueTasks = tasks.filter((task) => {
    if (
      Number(task.completed) === 1 ||
      !task.dueDate
    ) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  }).length;

  // =========================
  // DELETE TASK
  // =========================

  async function deleteTask(id) {
    try {
      const response = await fetch(
        `${API_URL}/tasks/${id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const data = await response.json();

        alert(data.message || "Failed to delete task");
        return;
      }

      await getTasks();
    } catch (error) {
      console.log("Delete error:", error);
      alert("Server error while deleting task");
    }
  }

  // =========================
  // TOGGLE COMPLETE
  // =========================

  async function toggleTask(id) {
    try {
      const selectedTask = tasks.find(
        (task) => task.id === id
      );

      if (!selectedTask) return;

      const response = await fetch(
        `${API_URL}/tasks/${id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            task: selectedTask.task,

            completed:
              Number(selectedTask.completed) === 1
                ? 0
                : 1,

            favorite: Number(selectedTask.favorite),

            priority: selectedTask.priority || "Medium",

            dueDate: selectedTask.dueDate || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();

        alert(data.message || "Failed to update task");
        return;
      }

      await getTasks();
    } catch (error) {
      console.log("Toggle complete error:", error);
      alert("Server error while updating task");
    }
  }

  // =========================
  // TOGGLE FAVORITE
  // =========================

  async function toggleFavorite(id) {
    try {
      const selectedTask = tasks.find(
        (task) => task.id === id
      );

      if (!selectedTask) return;

      const response = await fetch(
        `${API_URL}/tasks/${id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            task: selectedTask.task,

            completed: Number(selectedTask.completed),

            favorite:
              Number(selectedTask.favorite) === 1
                ? 0
                : 1,

            priority: selectedTask.priority || "Medium",

            dueDate: selectedTask.dueDate || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();

        alert(data.message || "Failed to update favorite");
        return;
      }

      await getTasks();
    } catch (error) {
      console.log("Favorite error:", error);
      alert("Server error while updating favorite");
    }
  }

  // =========================
  // RETURN UI
  // =========================

  return (
    <div className="app-main">
      {/* HERO */}

      <div className="hero">
        <h1>
          Welcome to{" "}
          <span
            style={{
              color: "var(--primary)",
            }}
          >
            AI Task Manager 🚀
          </span>
        </h1>

        <p>
          Organize your tasks and boost
          your productivity.
        </p>
      </div>

      {/* DARK MODE */}

      <button
        className="btn btn-secondary theme-btn"
        onClick={() => setDarkMode(!darkMode)}
        aria-label={
          darkMode
            ? "Switch to light mode"
            : "Switch to dark mode"
        }
      >
        {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
      </button>

      {/* DASHBOARD STATISTICS */}

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <FaTasks />
          </div>

          <div className="stat-info">
            <h3>{totalTasks}</h3>
            <p>Total Tasks</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon completed">
            <FaCheckCircle />
          </div>

          <div className="stat-info">
            <h3>{completedTasks}</h3>
            <p>Completed</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon active">
            <FaClock />
          </div>

          <div className="stat-info">
            <h3>{activeTasks}</h3>
            <p>Active</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon overdue">
            <FaExclamationTriangle />
          </div>

          <div className="stat-info">
            <h3>{overdueTasks}</h3>
            <p>Overdue</p>
          </div>
        </div>
      </div>

      {/* ADD TASK */}

      <div className="card">
        <h2 className="card-title">
          Add New Task
        </h2>

        <AddTask
          tasks={tasks}
          getTasks={getTasks}
        />
      </div>

      {/* SEARCH */}

      <div className="card">
        <h2 className="card-title">
          Search Task
        </h2>

        <SearchBar
          search={search}
          setSearch={setSearch}
        />
      </div>

      {/* PROGRESS */}

      <div className="card">
        <h2 className="card-title">
          Task Progress
        </h2>

        <ProgressBar
          total={totalTasks}
          completed={completedTasks}
        />
      </div>

      {/* TASK LIST */}

      <div className="card">
        <TaskList
          tasks={tasks}
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
      </div>
    </div>
  );
}

export default Home;