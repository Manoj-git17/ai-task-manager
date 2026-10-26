import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import {
  FiGrid,
  FiCheckSquare,
  FiStar,
  FiCalendar,
  FiTrendingUp,
  FiRefreshCw,
  FiCheckCircle,
  FiLogOut,
  FiPlus,
  FiSun,
  FiMoon,
  FiZap,
  FiArrowRight,
  FiCheck,
  FiAlertTriangle,
  FiEdit3,
  FiTrash2,
  FiX,
  FiSliders,
  FiClock,
  FiLayers,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiSearch,
  FiUser,
  FiFlag,
} from "react-icons/fi";

import { toast } from "react-toastify";
import { notifyTaskToggle } from "../utils/toastNotifications";

import AddTask from "../components/AddTask";
import DailyPlanner from "../components/DailyPlanner";
import ProductivityDashboard from "../components/ProductivityDashboard";
import SearchBar from "../components/SearchBar";
import TaskList from "../components/TaskList";
import TaskFlowSymbol from "../components/TaskFlowSymbol";
import UserProfileSettings from "../components/UserProfileSettings";
import AiChatAssistant from "../components/AiChatAssistant";

// Import local atmospheric mountain vector assets
import heroMountainsDark from "../assets/hero-mountains-dark.svg";
import heroMountainsLight from "../assets/hero-mountains-light.svg";

const QUICK_PRIORITY_OPTIONS = [
  { value: "High", label: "High", dotClass: "tf-priority-high" },
  { value: "Medium", label: "Medium", dotClass: "tf-priority-medium" },
  { value: "Low", label: "Low", dotClass: "tf-priority-low" },
];

let interactionCounter = 0;
function createInteractionId(prefix = "interaction") {
  interactionCounter += 1;
  return `${prefix}-${interactionCounter}`;
}

function Home({ darkMode, setDarkMode, tasks: propTasks, initialView }) {
  const navigate = useNavigate();

  // API configuration
  const API_URL = (
    import.meta.env.VITE_API_URL || "/api"
  ).replace(/\/+$/, "");

  // Normalize task data from backend or props
  const normalizeTask = (task) => {
    if (!task) return {};
    const title = task.task ?? task.title ?? task.name ?? task.text ?? "";
    return {
      ...task,
      task: title,
      title: title,
      completed:
        task.completed === true || Number(task.completed) === 1 ? 1 : 0,
      favorite:
        task.favorite === true || Number(task.favorite) === 1 ? 1 : 0,
      priority: task.priority || "Medium",
      dueDate: task.dueDate || "",
      completedAt: task.completedAt || null,
      workspace: task.workspace || "Engineering Core",
    };
  };

  const [tasks, setTasks] = useState(() => {
    if (Array.isArray(propTasks) && propTasks.length > 0) {
      return propTasks.map(normalizeTask);
    }
    try {
      const cached = localStorage.getItem("tf_cached_tasks");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeTask);
        }
      }
    } catch (err) {
      console.warn("Failed to read cached tasks:", err);
    }
    return [];
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [activeView, setActiveView] = useState(() => initialView || "overview"); // overview | tasks | favorites | planner | reschedule | intelligence | profile
  const [tasksViewMode, setTasksViewMode] = useState("stream"); // stream | matrix
  const [loadingTasks, setLoadingTasks] = useState(() => {
    if (Array.isArray(propTasks) && propTasks.length > 0) return false;
    try {
      const cached = localStorage.getItem("tf_cached_tasks");
      if (cached && JSON.parse(cached)?.length > 0) return false;
    } catch {
      // ignore
    }
    return true;
  });

  // Keep cached tasks synchronized in localStorage for instant rendering on page refresh
  useEffect(() => {
    if (Array.isArray(tasks) && tasks.length > 0) {
      try {
        localStorage.setItem("tf_cached_tasks", JSON.stringify(tasks));
      } catch (err) {
        console.warn("Failed to persist cached tasks:", err);
      }
    }
  }, [tasks]);
  const [backendError, setBackendError] = useState(null);

  useEffect(() => {
    if (initialView) {
      setActiveView(initialView);
    }
  }, [initialView]);

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("tf_sidebar_collapsed") === "true";
  });

  // Focus Mode state (filters only high priority & urgent items)
  const [focusMode, setFocusMode] = useState(false);

  // Overview task filter tab (all | active | today | high)
  const [overviewTaskFilter, setOverviewTaskFilter] = useState("all");

  // Task Grouping Mode: "day" | "flat"
  const [taskGrouping, setTaskGrouping] = useState("day");

  // Bulk Delete Modal State
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Day-Wise Specific Clear Modal State
  const [dayGroupToClear, setDayGroupToClear] = useState(null);
  const [clearingDayTasks, setClearingDayTasks] = useState(false);

  // Workspaces State
  const [userWorkspaces, setUserWorkspaces] = useState(() => {
    try {
      const stored = localStorage.getItem("tf_user_workspaces");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error("Failed to parse stored workspaces:", err);
    }
    return [
      { id: "all", name: "All Workspaces", dotClass: "dot-indigo", color: "#6366f1" },
      { id: "engineering", name: "Engineering Core", dotClass: "dot-violet", color: "#8b5cf6" },
      { id: "product", name: "Product Roadmap", dotClass: "dot-cyan", color: "#06b6d4" },
      { id: "personal", name: "Personal Focus", dotClass: "dot-emerald", color: "#10b981" },
    ];
  });

  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    return localStorage.getItem("tf_active_workspace") || "engineering";
  });

  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showAddWorkspaceModal, setShowAddWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceColor, setNewWorkspaceColor] = useState("#8b5cf6");
  const workspaceDropdownRef = useRef(null);

  // Close workspace dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(event.target)
      ) {
        setShowWorkspaceDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Current active workspace object
  const currentWorkspaceObj = useMemo(() => {
    const found = userWorkspaces.find((w) => w.id === activeWorkspace);
    return found || userWorkspaces[1] || userWorkspaces[0] || { id: "engineering", name: "Engineering Core", dotClass: "dot-violet", color: "#8b5cf6" };
  }, [userWorkspaces, activeWorkspace]);

  // Switch workspace
  const handleSelectWorkspace = (wsId) => {
    setActiveWorkspace(wsId);
    localStorage.setItem("tf_active_workspace", wsId);
    setShowWorkspaceDropdown(false);
    const target = userWorkspaces.find((w) => w.id === wsId);
    toast.success(`Switched to "${target?.name || wsId}" workspace`);
  };

  // Create new workspace
  const handleCreateWorkspace = (e) => {
    if (e) e.preventDefault();
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) {
      toast.warning("Please enter a workspace name.");
      return;
    }
    if (userWorkspaces.some((w) => w.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.warning("A workspace with this name already exists.");
      return;
    }
    const newWs = {
      id: `ws-${Date.now()}`,
      name: trimmed,
      color: newWorkspaceColor,
      dotClass: "dot-custom",
      custom: true,
    };
    const updated = [...userWorkspaces, newWs];
    setUserWorkspaces(updated);
    localStorage.setItem("tf_user_workspaces", JSON.stringify(updated));
    setActiveWorkspace(newWs.id);
    localStorage.setItem("tf_active_workspace", newWs.id);
    setNewWorkspaceName("");
    setShowAddWorkspaceModal(false);
    toast.success(`Created and switched to "${trimmed}" workspace.`);
  };

  // Delete custom workspace
  const handleDeleteWorkspace = (wsId, wsName) => {
    const updated = userWorkspaces.filter((w) => w.id !== wsId);
    setUserWorkspaces(updated);
    localStorage.setItem("tf_user_workspaces", JSON.stringify(updated));
    if (activeWorkspace === wsId) {
      setActiveWorkspace("engineering");
      localStorage.setItem("tf_active_workspace", "engineering");
    }
    toast.success(`Deleted workspace "${wsName}".`);
  };

  // Task count per workspace
  const getWorkspaceTaskCount = useCallback(
    (wsId) => {
      if (wsId === "all") return tasks.length;
      const wsObj = userWorkspaces.find((w) => w.id === wsId);
      const targetName = wsObj ? wsObj.name : wsId;
      return tasks.filter((t) => {
        const taskWs = t.workspace || "Engineering Core";
        return taskWs.toLowerCase() === targetName.toLowerCase();
      }).length;
    },
    [tasks, userWorkspaces]
  );

  // Inline Quick-Add state in main workspace
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskPriority, setQuickTaskPriority] = useState("Medium");
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const [isQuickPriorityOpen, setIsQuickPriorityOpen] = useState(false);
  const quickPriorityRef = useRef(null);

  // Close custom priority menu on click outside or escape
  useEffect(() => {
    if (!isQuickPriorityOpen) return;
    function handleClickOutside(event) {
      if (quickPriorityRef.current && !quickPriorityRef.current.contains(event.target)) {
        setIsQuickPriorityOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsQuickPriorityOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isQuickPriorityOpen]);

  // Hero AI Command Centre state
  const [aiInputText, setAiInputText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConfigOpen, setAiConfigOpen] = useState(false);
  const [aiConfigPriority, setAiConfigPriority] = useState("Medium");
  const [aiConfigDueDate, setAiConfigDueDate] = useState("");

  // Global AI Omnibar Console State (⌘K Modal)
  const [showAiConsole, setShowAiConsole] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandError, setCommandError] = useState("");
  const [commandSuccess, setCommandSuccess] = useState("");
  const omnibarInputRef = useRef(null);

  // Standard Modals
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiChatInjectedMessage, setAiChatInjectedMessage] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Inline AI Task Decomposition State
  const [inlineBreakdownTaskId, setInlineBreakdownTaskId] = useState(null);
  const [inlineSubtasks, setInlineSubtasks] = useState([]);
  const [loadingInlineBreakdown, setLoadingInlineBreakdown] = useState(false);
  const [addingInlineSubtasks, setAddingInlineSubtasks] = useState(false);

  // Edit Task State
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [editWorkspace, setEditWorkspace] = useState("Engineering Core");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Confirmation State
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Gemini AI Plan & Suggestions Modal State
  const [geminiPlanResult, setGeminiPlanResult] = useState(null);
  const [showGeminiPlanModal, setShowGeminiPlanModal] = useState(false);
  const [selectedPlanTaskIndices, setSelectedPlanTaskIndices] = useState(new Set());
  const [importingPlanTasks, setImportingPlanTasks] = useState(false);

  const PROMPT_SUGGESTIONS = [
    "Give me best plan for my DSA exam",
    "Clean and organize my bedroom today",
    "Study plan for DBMS exam in 5 days",
    "Build a modern React web app",
    "5-day morning workout routine",
  ];

  // Toggle sidebar collapse
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("tf_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Sync if propTasks changes
  useEffect(() => {
    if (Array.isArray(propTasks)) {
      setTasks(propTasks.map(normalizeTask));
      setLoadingTasks(false);
      setBackendError(null);
    }
  }, [propTasks]);

  // Read user profile
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

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const userName = currentUser?.name || getUserName();
  const userFirstName = userName.split(" ")[0] || "Account";
  const userAvatar = currentUser?.avatar || null;

  // Auth headers
  const getAuthHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  // Fetch full user profile from backend
  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/me`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      }
    } catch (err) {
      console.error("Fetch user profile error:", err);
    }
  }, [API_URL, getAuthHeaders]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const handleUserUpdated = (updatedUser, newToken) => {
    if (newToken) {
      localStorage.setItem("token", newToken);
    }
    if (updatedUser) {
      setCurrentUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  // Load tasks from backend
  const getTasks = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setTasks([]);
      setLoadingTasks(false);
      setBackendError(null);
      navigate("/login", { replace: true });
      return;
    }

    setLoadingTasks(true);
    setBackendError(null);

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("tf_cached_tasks");
        setTasks([]);
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load tasks (HTTP ${response.status})`);
      }

      const data = await response.json();
      const taskList = Array.isArray(data)
        ? data
        : Array.isArray(data.tasks)
          ? data.tasks
          : [];

      const normalized = taskList.map(normalizeTask);
      setTasks(normalized);
      setBackendError(null);
      try {
        localStorage.setItem("tf_cached_tasks", JSON.stringify(normalized));
      } catch (err) {
        console.warn("Failed to cache tasks:", err);
      }
    } catch (error) {
      console.error("Fetch tasks error:", error);
      const isConnectionError =
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("NetworkError") ||
        error.name === "TypeError";
      const errorMsg = isConnectionError
        ? `Cannot connect to backend at ${API_URL}. Please ensure the server is running.`
        : error.message || "Failed to load tasks from server.";
      setBackendError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoadingTasks(false);
    }
  }, [API_URL, navigate]);

  useEffect(() => {
    if (!Array.isArray(propTasks)) {
      getTasks();
    }
  }, [getTasks, propTasks]);

  // Keyboard Navigation & Shortcuts (⌘K, C/N, 1-6, Escape)
  useEffect(() => {
    function handleKeyDown(e) {
      const isInput =
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT" ||
        e.isContentEditable;

      // ⌘J or Ctrl+J triggers AI ChatGPT Assistant
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setShowAiChat((prev) => !prev);
        return;
      }

      // ⌘K or Ctrl+K triggers AI Command Omnibar
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setShowAiConsole((prev) => !prev);
        return;
      }

      // Escape closes any open modal or console
      if (e.key === "Escape") {
        setShowAiConsole(false);
        setShowAddTaskModal(false);
        setShowLogoutModal(false);
        setEditingTask(null);
        setTaskToDelete(null);
        setInlineBreakdownTaskId(null);
        return;
      }

      if (isInput) return;

      // Forward slash triggers Omnibar when not typing
      if (e.key === "/") {
        e.preventDefault();
        setShowAiConsole(true);
        return;
      }

      // 'C' opens manual task modal
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setShowAddTaskModal(true);
        return;
      }

      // 1-7 quick navigation
      if (e.key === "1") setActiveView("overview");
      if (e.key === "2") setActiveView("tasks");
      if (e.key === "3") setActiveView("favorites");
      if (e.key === "4") setActiveView("planner");
      if (e.key === "5") setActiveView("reschedule");
      if (e.key === "6") setActiveView("intelligence");
      if (e.key === "7") setActiveView("profile");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when AI console opens
  useEffect(() => {
    if (showAiConsole) {
      setTimeout(() => {
        if (omnibarInputRef.current) {
          omnibarInputRef.current.focus();
        }
      }, 50);
    }
  }, [showAiConsole]);

  // Real Workspace Statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => Number(t.completed) === 1).length;
  const activeTasks = totalTasks - completedTasks;

  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter((task) => {
      if (Number(task.completed) === 1 || !task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      if (Number.isNaN(dueDate.getTime())) return false;
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length;
  }, [tasks]);

  const tasksDueTodayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter((t) => {
      if (Number(t.completed) === 1 || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      if (Number.isNaN(due.getTime())) return false;
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    }).length;
  }, [tasks]);

  const highPriorityCount = useMemo(() => {
    return tasks.filter((t) => t.priority === "High" && Number(t.completed) !== 1).length;
  }, [tasks]);

  const favoriteTasksCount = tasks.filter((t) => Number(t.favorite) === 1).length;
  const completionPercentage =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const tasksCompletedThisWeek = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    return tasks.filter((task) => {
      if (Number(task.completed) !== 1) return false;
      if (task.completedAt) {
        const compDate = new Date(task.completedAt);
        if (!Number.isNaN(compDate.getTime())) {
          return compDate >= oneWeekAgo;
        }
      }
      return true;
    }).length;
  }, [tasks]);

  // Real 7-day completion chart data (Mon through Sun / last 7 days)
  const weeklyProgressData = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const dayName = d.toLocaleDateString("en-US", { weekday: "narrow" });
      const fullDay = d.toLocaleDateString("en-US", { weekday: "short" });
      const count = tasks.filter((t) => {
        if (Number(t.completed) !== 1 || !t.completedAt) return false;
        const comp = new Date(t.completedAt);
        return comp >= dayStart && comp <= dayEnd;
      }).length;

      days.push({ dayName, fullDay, count });
    }
    return days;
  }, [tasks]);

  const maxWeeklyProgress = useMemo(() => {
    const max = Math.max(...weeklyProgressData.map((d) => d.count));
    return max > 0 ? max : 1;
  }, [weeklyProgressData]);

  // Real upcoming deadlines (next 5 approaching tasks)
  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks
      .filter((t) => Number(t.completed) !== 1 && t.dueDate)
      .filter((t) => {
        const d = new Date(t.dueDate);
        return !Number.isNaN(d.getTime());
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);
  }, [tasks]);

  // Contextual greeting time
  const contextualGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // Formatted date string
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  // Real data-driven editorial summary
  const editorialSummary = useMemo(() => {
    if (totalTasks === 0) {
      return "Your workspace is ready. Use the AI command centre below to orchestrate your first tasks.";
    }
    const parts = [];
    if (overdueTasks > 0) {
      parts.push(`${overdueTasks} urgent task${overdueTasks > 1 ? "s" : ""} require intervention`);
    }
    if (tasksDueTodayCount > 0) {
      parts.push(`${tasksDueTodayCount} task${tasksDueTodayCount > 1 ? "s" : ""} scheduled for today`);
    }
    if (parts.length === 0) {
      parts.push("All deadlines are clear for today");
    }
    return `${parts.join(", and ")}. You have completed ${tasksCompletedThisWeek} tasks this week with ${completionPercentage}% overall completion momentum.`;
  }, [totalTasks, overdueTasks, tasksDueTodayCount, tasksCompletedThisWeek, completionPercentage]);

  // Handle API responses consistently
  const handleTaskResponse = useCallback(async (response, fallbackMessage) => {
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setTasks([]);
      navigate("/login", { replace: true });
      return null;
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || fallbackMessage);
    }

    return data;
  }, [navigate]);

  // Delete a task
  async function deleteTask(id) {
    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const success = await handleTaskResponse(response, "Failed to delete task.");
      if (!success) return;

      setTasks((prev) => prev.filter((task) => String(task.id) !== String(id)));
      toast.success("Task deleted successfully.");
    } catch (error) {
      console.error("Delete task error:", error);
      toast.error(error.message || "Unable to delete task.");
    }
  }

  // Toggle completion
  async function toggleTask(id) {
    const selectedTask = tasks.find((t) => String(t.id) === String(id));
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

      const success = await handleTaskResponse(response, "Failed to update task.");
      if (!success) return;

      setTasks((prev) =>
        prev.map((t) =>
          String(t.id) === String(id)
            ? {
                ...t,
                completed: nextCompleted ? 1 : 0,
                completedAt: nextCompleted ? new Date().toISOString() : null,
              }
            : t
        )
      );

      notifyTaskToggle(selectedTask.task, nextCompleted);
    } catch (error) {
      console.error("Toggle task error:", error);
      toast.error(error.message || "Unable to update task.");
    }
  }

  // Toggle favorite
  async function toggleFavorite(id) {
    const selectedTask = tasks.find((t) => String(t.id) === String(id));
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

      const success = await handleTaskResponse(response, "Failed to update favorite.");
      if (!success) return;

      setTasks((prev) =>
        prev.map((t) =>
          String(t.id) === String(id)
            ? {
                ...t,
                favorite: nextFavorite ? 1 : 0,
              }
            : t
        )
      );

      toast.success(nextFavorite ? "Added to favorites." : "Removed from favorites.");
    } catch (error) {
      console.error("Favorite error:", error);
      toast.error(error.message || "Unable to update favorite.");
    }
  }

  // Update task details
  const updateTask = useCallback(async (id, { task, priority, dueDate, workspace }) => {
    const selectedTask = tasks.find((item) => String(item.id) === String(id));
    if (!selectedTask) return false;

    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          task: task.trim(),
          completed: Number(selectedTask.completed) === 1,
          favorite: Number(selectedTask.favorite) === 1,
          priority: priority || "Medium",
          dueDate: dueDate || null,
          workspace: workspace || selectedTask.workspace || "Engineering Core",
        }),
      });

      const data = await handleTaskResponse(response, "Failed to update task.");
      if (!data) return false;

      const updated = data.task
        ? normalizeTask(data.task)
        : {
            ...selectedTask,
            task: task.trim(),
            priority: priority || "Medium",
            dueDate: dueDate || "",
            workspace: workspace || selectedTask.workspace || "Engineering Core",
          };

      setTasks((prev) =>
        prev.map((item) => (String(item.id) === String(id) ? updated : item))
      );

      toast.success("Task updated successfully!");
      return true;
    } catch (error) {
      console.error("Update task error:", error);
      toast.error(error.message || "Unable to update task.");
      return false;
    }
  }, [API_URL, getAuthHeaders, handleTaskResponse, tasks]);

  // Inline AI Subtask Breakdown Trigger
  async function toggleInlineBreakdown(taskItem) {
    if (inlineBreakdownTaskId === taskItem.id) {
      setInlineBreakdownTaskId(null);
      setInlineSubtasks([]);
      return;
    }

    setInlineBreakdownTaskId(taskItem.id);
    setLoadingInlineBreakdown(true);
    setInlineSubtasks([]);

    try {
      const response = await fetch(`${API_URL}/ai/breakdown`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          task: taskItem.task || taskItem.title || "",
          priority: taskItem.priority || "Medium",
          dueDate: taskItem.dueDate || null,
          live: true,
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
        setInlineSubtasks(
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
        setInlineBreakdownTaskId(null);
      }
    } catch (err) {
      console.error("AI breakdown error:", err);
      toast.error("Could not reach AI breakdown service.");
      setInlineBreakdownTaskId(null);
    } finally {
      setLoadingInlineBreakdown(false);
    }
  }

  function toggleSubtaskCheck(index) {
    setInlineSubtasks((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  }

  async function addInlineSubtasks() {
    const selectedList = inlineSubtasks.filter((s) => s.selected && s.task.trim());
    if (selectedList.length === 0) {
      toast.warning("Please select at least one subtask to import.");
      return;
    }

    setAddingInlineSubtasks(true);
    try {
      for (const item of selectedList) {
        await fetch(`${API_URL}/tasks`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            task: item.task.trim(),
            priority: item.priority || "Medium",
            dueDate: item.dueDate || null,
          }),
        });
      }

      toast.success(`Imported ${selectedList.length} subtasks to your workspace!`);
      setInlineBreakdownTaskId(null);
      setInlineSubtasks([]);
      await getTasks();
    } catch (err) {
      console.error("Add subtasks error:", err);
      toast.error("Failed to add all subtasks.");
    } finally {
      setAddingInlineSubtasks(false);
    }
  }

  // Edit modal triggers
  function openEditModal(taskItem) {
    setEditingTask(taskItem);
    setEditTitle(taskItem.task || taskItem.title || "");
    setEditPriority(taskItem.priority || "Medium");
    setEditDueDate(taskItem.dueDate || "");
    setEditWorkspace(taskItem.workspace || "Engineering Core");
  }

  function closeEditModal() {
    setEditingTask(null);
    setEditTitle("");
    setEditPriority("Medium");
    setEditDueDate("");
    setEditWorkspace("Engineering Core");
  }

  async function handleSaveEdit() {
    if (!editingTask || !editTitle.trim()) {
      toast.error("Please enter a task title.");
      return;
    }

    setSavingEdit(true);
    try {
      const success = await updateTask(editingTask.id, {
        task: editTitle.trim(),
        priority: editPriority,
        dueDate: editDueDate || null,
        workspace: editWorkspace || "Engineering Core",
      });

      if (success) {
        closeEditModal();
      }
    } finally {
      setSavingEdit(false);
    }
  }

  // Delete modal triggers
  function openDeleteModal(taskItem) {
    setTaskToDelete(taskItem);
  }

  function closeDeleteModal() {
    setTaskToDelete(null);
  }

  async function handleConfirmDelete() {
    if (!taskToDelete) return;
    await deleteTask(taskToDelete.id);
    closeDeleteModal();
  }

  // Bulk / Delete All Tasks Handler
  async function handleDeleteAllTasks(onlyCompleted = false) {
    if (deletingAll) return;
    setDeletingAll(true);

    try {
      const url = onlyCompleted
        ? `${API_URL}/tasks?status=completed`
        : `${API_URL}/tasks`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: getAuthHeaders(),
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
        if (onlyCompleted) {
          setTasks((prev) => prev.filter((t) => Number(t.completed) !== 1));
        } else {
          setTasks([]);
        }
        await getTasks();
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

  // Open Day-Specific Clear Modal
  const handlePromptClearDayTasks = (group) => {
    if (!group || !Array.isArray(group.tasks) || group.tasks.length === 0) return;
    setDayGroupToClear(group);
  };

  // Confirm Day-Specific Clear (All or Completed Only)
  async function handleConfirmClearDayTasks(onlyCompleted = false) {
    if (!dayGroupToClear || !Array.isArray(dayGroupToClear.tasks)) return;

    const targetTasks = onlyCompleted
      ? dayGroupToClear.tasks.filter((t) => Number(t.completed) === 1)
      : dayGroupToClear.tasks;

    if (targetTasks.length === 0) {
      toast.info(`No completed tasks to clear in ${dayGroupToClear.title}.`);
      return;
    }

    const taskIdsToDelete = targetTasks.map((t) => t.id);
    const taskIdsSet = new Set(taskIdsToDelete);

    setClearingDayTasks(true);

    try {
      const response = await fetch(`${API_URL}/tasks/bulk-delete`, {
        method: "POST",
        headers: getAuthHeaders(),
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
        setTasks((prev) => prev.filter((t) => !taskIdsSet.has(t.id)));
        toast.success(
          onlyCompleted
            ? `Cleared ${targetTasks.length} completed task(s) from ${dayGroupToClear.title}.`
            : `Deleted all ${targetTasks.length} task(s) from ${dayGroupToClear.title}.`
        );
        setDayGroupToClear(null);
        await getTasks();
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

  // Hero AI Command Centre Creation — Intent-aware dispatcher (like ChatGPT)
  async function handleHeroAiSubmit(e) {
    if (e) e.preventDefault();
    const textToSubmit = aiInputText.trim();
    if (!textToSubmit) {
      toast.warning("Please describe a task or ask AI for a plan or question.");
      return;
    }

    setAiLoading(true);

    try {
      // 1. Intent-aware unified AI endpoint: dispatches appropriately based on user's actual intent
      const queryResponse = await fetch(`${API_URL}/ai/query`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text: textToSubmit,
          currentTasks: tasks,
          referenceDate: new Date().toISOString(),
        }),
      });

      const data = await queryResponse.json().catch(() => ({}));

      if (!queryResponse.ok || !data.success) {
        throw new Error(data.message || "Unable to process request with AI.");
      }

      // Safety net: If user asked for schedule or plan but backend returned create_task
      if (
        data.action === "create_task" &&
        /\b(?:schedule|plan|routine|timetable|time\s*table|clean|roadmap|study|exam|workout|gym)\b/i.test(textToSubmit)
      ) {
        try {
          const planRes = await fetch(`${API_URL}/ai/plan`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              goal: textToSubmit,
              currentTasks: tasks,
              referenceDate: new Date().toISOString(),
            }),
          });
          const planData = await planRes.json().catch(() => ({}));
          if (planData.success && planData.plan) {
            data.action = "plan";
            data.plan = planData.plan;
          }
        } catch {
          // fallback to direct task if plan network fails
        }
      }

      // A. Task Creation: Direct addition to the board without unnecessary modals
      if (data.action === "create_task") {
        const finalTask = data.task || textToSubmit;
        const finalPriority =
          aiConfigOpen && aiConfigPriority
            ? aiConfigPriority
            : data.priority || "Medium";
        const finalDueDate =
          aiConfigOpen && aiConfigDueDate
            ? aiConfigDueDate
            : data.dueDate || null;

        await handleAddDirectTask({
          task: finalTask,
          priority: finalPriority,
          dueDate: finalDueDate,
        });

        toast.success(`✨ Created task: "${finalTask}" (${finalPriority} priority)`);
        setAiInputText("");
        setAiConfigOpen(false);
        return;
      }

      // B. Structured Planning (Study Plan, Exam Preparation, Project Planning)
      if (data.action === "plan" && data.plan) {
        const plan = data.plan;
        setGeminiPlanResult(plan);
        const allIndices = new Set(
          (plan.actionableTasks || []).map((_, idx) => idx)
        );
        setSelectedPlanTaskIndices(allIndices);
        setShowGeminiPlanModal(true);
        const durationText = (plan.days || plan.totalDays) === 1
          ? "1-day schedule"
          : `${plan.days || plan.totalDays || 5}-day schedule & plan`;
        toast.success(`✨ Generated a ${durationText} for "${plan.subject || 'your goal'}"!`);
        setAiInputText("");
        setAiConfigOpen(false);
        return;
      }

      // C. Task Breakdown
      if (data.action === "breakdown") {
        const taskTitle = data.task || textToSubmit;
        const subtasks = Array.isArray(data.subtasks) ? data.subtasks : [];
        const replyText =
          `## Engineering Breakdown: ${taskTitle}\n\nHere are the step-by-step decomposed tasks:\n` +
          subtasks
            .map(
              (st, i) =>
                `${i + 1}. **${st.title || st.task}** (${st.durationMinutes || 45} mins) — *${st.priority || "Medium"} priority*`
            )
            .join("\n");

        const suggestedTasks = subtasks.map((st) => ({
          task: st.title || st.task,
          priority: st.priority || "Medium",
          duration: `${st.durationMinutes || 45}m`,
        }));

        setAiChatInjectedMessage({
          id: createInteractionId("hero"),
          userQuery: textToSubmit,
          replyText,
          suggestedTasks,
          provider: data.provider || "TaskFlow AI Decomposer",
        });
        setShowAiChat(true);
        toast.info("✨ Task decomposition ready in your AI Assistant!");
        setAiInputText("");
        setAiConfigOpen(false);
        return;
      }

      // D. Scheduling & Rescheduling Guidance
      if (data.action === "reschedule") {
        setAiChatInjectedMessage({
          id: createInteractionId("hero"),
          userQuery: textToSubmit,
          replyText: `## ${data.title || "Workload & Schedule Management"}\n\n${data.guidance || "You can review and balance overdue tasks in the Smart Rescheduler tab."}`,
          suggestedTasks: [],
          provider: data.provider || "TaskFlow Rescheduler",
        });
        setShowAiChat(true);
        toast.info("📅 Scheduling guidance opened in AI Assistant!");
        setAiInputText("");
        setAiConfigOpen(false);
        return;
      }

      // E. Conversational Explanation, Programming Code Help, Career Guidance, or Clarification
      let replyText = "";
      if (typeof data.answer === "string") {
        replyText = data.answer;
      } else if (data.answer && typeof data.answer.explanation === "string") {
        replyText = `## ${data.answer.title || "AI Response"}\n\n${data.answer.explanation}`;
        if (Array.isArray(data.answer.keyTakeaways) && data.answer.keyTakeaways.length > 0) {
          replyText +=
            `\n\n### Key Takeaways\n` +
            data.answer.keyTakeaways
              .map((t) => `- **${t.point}**: ${t.detail}`)
              .join("\n");
        }
        if (data.answer.codeExample) {
          replyText += `\n\n### Code Implementation\n\`\`\`${data.answer.codeExample.language || "javascript"}\n${data.answer.codeExample.code}\n\`\`\``;
        }
        if (Array.isArray(data.answer.recommendedPractice) && data.answer.recommendedPractice.length > 0) {
          replyText +=
            `\n\n### Recommended Next Steps\n` +
            data.answer.recommendedPractice.map((p) => `- ${p}`).join("\n");
        }
      } else if (data.followUpQuestion) {
        replyText = `## ${data.title || "Clarification Needed"}\n\n${data.answer || ""}\n\n**Clarification Question:** ${data.followUpQuestion}`;
      } else {
        replyText = data.reply || "Here is the guidance based on your request.";
      }

      setAiChatInjectedMessage({
        id: createInteractionId("hero"),
        userQuery: textToSubmit,
        replyText,
        suggestedTasks: Array.isArray(data.suggestedTasks) ? data.suggestedTasks : [],
        provider: data.provider || "TaskFlow AI (Live)",
      });
      setShowAiChat(true);
      toast.info("💡 AI answered your question in the Assistant!");
      setAiInputText("");
      setAiConfigOpen(false);
    } catch (err) {
      console.error("Hero AI submit error:", err);
      // Fallback: If network or query fails unexpectedly, parse & create task so work is never lost
      try {
        const parseResponse = await fetch(`${API_URL}/ai/parse`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            text: textToSubmit,
            referenceDate: new Date().toISOString(),
          }),
        });

        const parseData = await parseResponse.json().catch(() => ({}));
        const finalTask = parseData.task || textToSubmit;
        const finalPriority =
          aiConfigOpen && aiConfigPriority
            ? aiConfigPriority
            : parseData.priority || "Medium";
        const finalDueDate =
          aiConfigOpen && aiConfigDueDate
            ? aiConfigDueDate
            : parseData.dueDate || null;

        await handleAddDirectTask({
          task: finalTask,
          priority: finalPriority,
          dueDate: finalDueDate,
        });

        toast.success(`Task created: "${finalTask}" (${finalPriority})`);
        setAiInputText("");
        setAiConfigOpen(false);
        return;
      } catch (fallbackErr) {
        console.error("Fallback creation error:", fallbackErr);
      }

      toast.error(err.message || "Failed to process request with AI.");
    } finally {
      setAiLoading(false);
    }
  }

  // Create single task directly from Hero AI drawer (for users wanting to bypass AI planning)
  async function handleHeroSingleTaskCreate() {
    const textToSubmit = aiInputText.trim();
    if (!textToSubmit) {
      toast.warning("Please enter a task description.");
      return;
    }

    setAiLoading(true);
    try {
      const parseResponse = await fetch(`${API_URL}/ai/parse`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text: textToSubmit,
          referenceDate: new Date().toISOString(),
        }),
      });

      const parseData = await parseResponse.json().catch(() => ({}));
      const finalTask = parseData.task || textToSubmit;
      const finalPriority =
        aiConfigOpen && aiConfigPriority
          ? aiConfigPriority
          : parseData.priority || "Medium";
      const finalDueDate =
        aiConfigOpen && aiConfigDueDate
          ? aiConfigDueDate
          : parseData.dueDate || null;

      const createResponse = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          task: finalTask,
          priority: finalPriority,
          dueDate: finalDueDate,
        }),
      });

      const createData = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        throw new Error(createData.message || "Failed to create task.");
      }

      const createdItem = createData.task ? normalizeTask(createData.task) : null;
      if (createdItem) {
        setTasks((prev) => [createdItem, ...prev]);
      } else {
        await getTasks();
      }

      toast.success(`Task created: "${finalTask}" (${finalPriority})`);
      setAiInputText("");
      setAiConfigOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to create task.");
    } finally {
      setAiLoading(false);
    }
  }

  // Add as Single Task Instead from Gemini Plan Modal
  async function handleAddPlanAsSingleTask() {
    if (!geminiPlanResult) return;
    setImportingPlanTasks(true);

    try {
      const taskName = geminiPlanResult.subject || geminiPlanResult.goal;
      const dueDate = geminiPlanResult.schedule?.[0]?.date || null;

      const response = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          task: taskName,
          priority: "High",
          dueDate: dueDate,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const createdItem = data.task ? normalizeTask(data.task) : null;
        if (createdItem) {
          setTasks((prev) => [createdItem, ...prev]);
        } else {
          await getTasks();
        }
        toast.success(`✨ Added "${taskName}" as a single task to your workspace.`);
        setShowGeminiPlanModal(false);
        setGeminiPlanResult(null);
      } else {
        throw new Error(data.message || "Failed to create task.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to add task.");
    } finally {
      setImportingPlanTasks(false);
    }
  }

  // Import Gemini Plan Tasks into Workspace
  async function handleImportGeminiPlanTasks() {
    if (!geminiPlanResult || !Array.isArray(geminiPlanResult.actionableTasks)) return;

    const tasksToCreate = geminiPlanResult.actionableTasks.filter((_, idx) =>
      selectedPlanTaskIndices.has(idx)
    );

    if (tasksToCreate.length === 0) {
      toast.warning("Please select at least one task to import.");
      return;
    }

    setImportingPlanTasks(true);

    const targetWsObj = userWorkspaces.find((w) => w.id === activeWorkspace);
    const targetWsName =
      targetWsObj && targetWsObj.id !== "all"
        ? targetWsObj.name
        : "Engineering Core";

    try {
      const response = await fetch(`${API_URL}/tasks/bulk`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          workspace: targetWsName,
          tasks: tasksToCreate.map((t) => ({
            task: t.task,
            priority: t.priority || "Medium",
            dueDate: t.dueDate || null,
            workspace: targetWsName,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        const addedTasks = Array.isArray(data.tasks) ? data.tasks.map(normalizeTask) : [];
        if (addedTasks.length > 0) {
          setTasks((prev) => [...addedTasks, ...prev]);
        } else {
          await getTasks();
        }
        toast.success(`✨ Added ${tasksToCreate.length} plan tasks to "${targetWsName}"!`);
        setShowGeminiPlanModal(false);
        setGeminiPlanResult(null);
      } else {
        throw new Error(data.message || "Failed to import plan tasks.");
      }
    } catch (err) {
      console.error("Import plan tasks error:", err);
      toast.error(err.message || "Failed to import tasks to workspace.");
    } finally {
      setImportingPlanTasks(false);
    }
  }


  // Direct task creator for AI Chat Assistant and quick integrations
  const handleAddDirectTask = async ({ task, priority, dueDate, workspace }) => {
    const targetWsObj = userWorkspaces.find((w) => w.id === activeWorkspace);
    const targetWsName =
      workspace ||
      (targetWsObj && targetWsObj.id !== "all"
        ? targetWsObj.name
        : "Engineering Core");

    const response = await fetch(`${API_URL}/tasks`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        task: task.trim(),
        priority: priority || "Medium",
        dueDate: dueDate || null,
        workspace: targetWsName,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Failed to create task.");
    }

    const createdItem = data.task ? normalizeTask(data.task) : null;
    if (createdItem) {
      setTasks((prev) => [createdItem, ...prev]);
    } else {
      await getTasks();
    }
    return createdItem;
  };

  // Inline Quick Add Task
  async function handleQuickAdd(e) {
    if (e) e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    const targetWsObj = userWorkspaces.find((w) => w.id === activeWorkspace);
    const targetWsName =
      targetWsObj && targetWsObj.id !== "all"
        ? targetWsObj.name
        : "Engineering Core";

    setIsSubmittingQuick(true);
    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          task: quickTaskTitle.trim(),
          priority: quickTaskPriority,
          dueDate: null,
          workspace: targetWsName,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to create task.");
      }

      const createdItem = data.task ? normalizeTask(data.task) : null;
      if (createdItem) {
        setTasks((prev) => [createdItem, ...prev]);
      } else {
        await getTasks();
      }

      setQuickTaskTitle("");
      toast.success(`Task added to "${targetWsName}".`);
    } catch (err) {
      toast.error(err.message || "Unable to add task.");
    } finally {
      setIsSubmittingQuick(false);
    }
  }

  // AI Command Omnibar Execution (⌘K Modal) — Intent-aware dispatcher
  async function handleCommandSubmit(overrideText) {
    const textToSubmit =
      typeof overrideText === "string" ? overrideText.trim() : commandInput.trim();
    if (!textToSubmit) {
      setCommandError("Please enter a task, question, or goal.");
      return;
    }

    setCommandLoading(true);
    setCommandError("");
    setCommandSuccess("");

    try {
      const queryResponse = await fetch(`${API_URL}/ai/query`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text: textToSubmit,
          currentTasks: tasks,
          referenceDate: new Date().toISOString(),
        }),
      });

      const data = await queryResponse.json().catch(() => ({}));

      if (!queryResponse.ok || !data.success) {
        throw new Error(data.message || "Failed to process AI command.");
      }

      // A. Direct Task Creation
      if (data.action === "create_task") {
        const finalTask = data.task || textToSubmit;
        const finalPriority = data.priority || "Medium";
        const finalDueDate = data.dueDate || null;

        await handleAddDirectTask({
          task: finalTask,
          priority: finalPriority,
          dueDate: finalDueDate,
        });

        setCommandSuccess(`Created: "${finalTask}" · ${finalPriority}`);
        toast.success(`✨ Created task: "${finalTask}"`);
        setCommandInput("");

        setTimeout(() => {
          setShowAiConsole(false);
          setCommandSuccess("");
        }, 800);
        return;
      }

      // B. Structured Planning
      if (data.action === "plan" && data.plan) {
        const plan = data.plan;
        setGeminiPlanResult(plan);
        const allIndices = new Set(
          (plan.actionableTasks || []).map((_, idx) => idx)
        );
        setSelectedPlanTaskIndices(allIndices);
        setShowAiConsole(false);
        setCommandInput("");
        setShowGeminiPlanModal(true);
        toast.success(`✨ AI generated a plan for "${plan.subject}"!`);
        return;
      }

      // C. Breakdown, Reschedule, Explanation, Code Help, Career Guidance
      let replyText = "";
      let suggestedTasks = [];

      if (data.action === "breakdown") {
        const subtasks = Array.isArray(data.subtasks) ? data.subtasks : [];
        replyText =
          `## Engineering Breakdown: ${data.task || textToSubmit}\n\n` +
          subtasks
            .map(
              (st, i) =>
                `${i + 1}. **${st.title || st.task}** (${st.durationMinutes || 45} mins) — *${st.priority || "Medium"}*`
            )
            .join("\n");
        suggestedTasks = subtasks.map((st) => ({
          task: st.title || st.task,
          priority: st.priority || "Medium",
          duration: `${st.durationMinutes || 45}m`,
        }));
      } else if (data.action === "reschedule") {
        replyText = `## ${data.title || "Workload & Schedule Management"}\n\n${data.guidance || "You can review and balance overdue tasks in the Smart Rescheduler tab."}`;
      } else if (typeof data.answer === "string") {
        replyText = data.answer;
      } else if (data.answer && typeof data.answer.explanation === "string") {
        replyText = `## ${data.answer.title || "AI Response"}\n\n${data.answer.explanation}`;
        if (Array.isArray(data.answer.keyTakeaways) && data.answer.keyTakeaways.length > 0) {
          replyText +=
            `\n\n### Key Takeaways\n` +
            data.answer.keyTakeaways
              .map((t) => `- **${t.point}**: ${t.detail}`)
              .join("\n");
        }
        if (data.answer.codeExample) {
          replyText += `\n\n### Code Implementation\n\`\`\`${data.answer.codeExample.language || "javascript"}\n${data.answer.codeExample.code}\n\`\`\``;
        }
      } else if (data.followUpQuestion) {
        replyText = `## ${data.title || "Clarification Needed"}\n\n${data.answer || ""}\n\n**Clarification Question:** ${data.followUpQuestion}`;
      } else {
        replyText = data.reply || "Here is the guidance based on your request.";
      }

      if (Array.isArray(data.suggestedTasks) && data.suggestedTasks.length > 0) {
        suggestedTasks = data.suggestedTasks;
      }

      setAiChatInjectedMessage({
        id: createInteractionId("console"),
        userQuery: textToSubmit,
        replyText,
        suggestedTasks,
        provider: data.provider || "TaskFlow AI (Live)",
      });
      setShowAiConsole(false);
      setCommandInput("");
      setShowAiChat(true);
      toast.info("💡 AI answered in the Assistant drawer!");
    } catch (err) {
      console.error("Command submit error:", err);
      setCommandError(err.message || "Could not process command.");
      toast.error(err.message || "Failed to create task from command.");
    } finally {
      setCommandLoading(false);
    }
  }

  // Sign out
  const handleLogout = () => {
    setShowLogoutModal(false);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("tf_cached_tasks");
    setTasks([]);
    navigate("/login", { replace: true });
  };

  // Change workspace view
  const changeView = (view) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Relative Date Formatter
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
        label: target.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        statusClass: "due-completed",
      };
    }

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        label: overdueDays === 1 ? "Overdue 1d" : `Overdue ${overdueDays}d`,
        statusClass: "due-overdue",
      };
    }
    if (diffDays === 0) {
      return { label: "Today", statusClass: "due-today" };
    }
    if (diffDays === 1) {
      return { label: "Tomorrow", statusClass: "due-tomorrow" };
    }
    return {
      label: target.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      statusClass: "due-upcoming",
    };
  }

  // Filtered Critical Path Tasks for Overview Workspace
  const filteredCriticalTasks = useMemo(() => {
    let list = tasks;

    // Filter by Active Workspace (unless "all")
    if (activeWorkspace !== "all") {
      const selectedWsObj = userWorkspaces.find((w) => w.id === activeWorkspace);
      const targetName = selectedWsObj ? selectedWsObj.name : activeWorkspace;
      list = list.filter((t) => {
        const taskWs = t.workspace || "Engineering Core";
        return taskWs.toLowerCase() === targetName.toLowerCase();
      });
    }

    // Focus mode filters down to urgent or high priority items only
    if (focusMode) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter((t) => {
        if (Number(t.completed) === 1) return false;
        if (t.priority === "High") return true;
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        if (Number.isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);
        return d <= today;
      });
      return list;
    }

    if (overviewTaskFilter === "active") {
      list = list.filter((t) => Number(t.completed) !== 1);
    } else if (overviewTaskFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        if (Number.isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });
    } else if (overviewTaskFilter === "high") {
      list = list.filter((t) => t.priority === "High");
    }

    // Sort order: Overdue first, then High priority, then date
    return [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed - b.completed;
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDue - bDue;
    });
  }, [tasks, focusMode, overviewTaskFilter, activeWorkspace, userWorkspaces]);

  // Grouped Tasks for Day-Wise Separation in Overview
  const groupedCriticalTasksByDay = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const groupsMap = new Map();

    const getBucket = (taskItem) => {
      const isDone = Number(taskItem.completed) === 1;
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
          subtitle: "Flexible / Backlog",
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
          subtitle: "Flexible / Backlog",
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

    for (const t of filteredCriticalTasks) {
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
  }, [filteredCriticalTasks]);

  // Tasks for Full Catalog & Eisenhower Matrix
  const displayedTasks = useMemo(() => {
    let list = [...tasks];

    // Filter by Active Workspace (unless "all")
    if (activeWorkspace !== "all") {
      const selectedWsObj = userWorkspaces.find((w) => w.id === activeWorkspace);
      const targetName = selectedWsObj ? selectedWsObj.name : activeWorkspace;
      list = list.filter((t) => {
        const taskWs = t.workspace || "Engineering Core";
        return taskWs.toLowerCase() === targetName.toLowerCase();
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => (t.task || t.title || "").toLowerCase().includes(q));
    }

    if (filter === "active") {
      list = list.filter((t) => Number(t.completed) !== 1);
    } else if (filter === "completed") {
      list = list.filter((t) => Number(t.completed) === 1);
    }

    if (priorityFilter !== "all") {
      list = list.filter((t) => t.priority === priorityFilter);
    }

    if (sortBy === "oldest") {
      list.sort((a, b) => (a.id || 0) - (b.id || 0));
    } else if (sortBy === "dueDate") {
      list.sort((a, b) => {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return ad - bd;
      });
    } else if (sortBy === "priority") {
      const pWeights = { High: 3, Medium: 2, Low: 1 };
      list.sort((a, b) => (pWeights[b.priority] || 0) - (pWeights[a.priority] || 0));
    } else {
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    return list;
  }, [tasks, search, filter, priorityFilter, sortBy, activeWorkspace, userWorkspaces]);

  // Eisenhower Matrix Categorization
  const eisenhowerQuadrants = useMemo(() => {
    const activeOnly = tasks.filter((t) => Number(t.completed) !== 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isUrgent = (t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      if (Number.isNaN(d.getTime())) return false;
      d.setHours(0, 0, 0, 0);
      return d <= today;
    };

    const isHighImpact = (t) => t.priority === "High";

    return {
      q1: activeOnly.filter((t) => isUrgent(t) && isHighImpact(t)),
      q2: activeOnly.filter((t) => !isUrgent(t) && isHighImpact(t)),
      q3: activeOnly.filter((t) => isUrgent(t) && !isHighImpact(t)),
      q4: activeOnly.filter((t) => !isUrgent(t) && !isHighImpact(t)),
    };
  }, [tasks]);

  // Renderer for Individual Overview Task Card
  const renderOverviewTaskCard = (taskItem) => {
    const isDone = Number(taskItem.completed) === 1;
    const isFav = Number(taskItem.favorite) === 1;
    const dueInfo = formatDueDate(taskItem.dueDate, isDone);
    const isBreakdownExpanded = inlineBreakdownTaskId === taskItem.id;

    return (
      <div
        key={taskItem.id}
        className={`tf-task-row ${isDone ? "completed" : ""} ${
          dueInfo?.statusClass === "due-overdue" ? "is-overdue" : ""
        }`}
      >
        <div className="tf-task-row-main">
          {/* Custom Checkbox */}
          <button
            type="button"
            className={`tf-custom-checkbox ${isDone ? "checked" : ""}`}
            onClick={() => toggleTask(taskItem.id)}
            aria-label={isDone ? "Mark active" : "Mark completed"}
          >
            {isDone && <FiCheck className="tf-check-mark" />}
          </button>

          {/* Task Details */}
          <div className="tf-task-content">
            <span className={`tf-task-title ${isDone ? "strikethrough" : ""}`}>
              {taskItem.task || taskItem.title}
            </span>

            <div className="tf-task-meta">
              {/* Priority Badge */}
              <span
                className={`tf-priority-badge ${
                  taskItem.priority ? taskItem.priority.toLowerCase() : "medium"
                }`}
              >
                {taskItem.priority || "Medium"}
              </span>

              {/* Due Date Indicator */}
              {dueInfo && (
                <span className={`tf-due-badge ${dueInfo.statusClass}`}>
                  <FiClock className="tf-meta-icon" />
                  <span>{dueInfo.label}</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="tf-task-actions">
            {/* AI Subtask Decomposition Drawer Button */}
            {!isDone && (
              <button
                type="button"
                className={`tf-btn-action-breakdown ${
                  isBreakdownExpanded ? "active" : ""
                }`}
                onClick={() => toggleInlineBreakdown(taskItem)}
                title="AI Subtask Decomposition"
              >
                <FiZap />
                <span>Breakdown</span>
              </button>
            )}

            {/* Favorite Star */}
            <button
              type="button"
              className={`tf-btn-action-icon favorite ${isFav ? "favorite-active" : ""}`}
              onClick={() => toggleFavorite(taskItem.id)}
              title={isFav ? "Remove favorite" : "Star task"}
              aria-label="Toggle favorite"
            >
              <FiStar />
            </button>

            {/* Edit Button */}
            <button
              type="button"
              className="tf-btn-action-icon edit"
              onClick={() => openEditModal(taskItem)}
              title="Edit task"
              aria-label="Edit task"
            >
              <FiEdit3 />
            </button>

            {/* Delete Button */}
            <button
              type="button"
              className="tf-btn-action-icon delete"
              onClick={() => openDeleteModal(taskItem)}
              title="Delete task"
              aria-label="Delete task"
            >
              <FiTrash2 />
            </button>
          </div>
        </div>

        {/* INLINE AI SUBTASK BREAKDOWN DRAWER */}
        {isBreakdownExpanded && (
          <div className="tf-inline-subtasks-drawer">
            <div className="tf-drawer-header">
              <div className="tf-drawer-title-wrap">
                <FiZap className="tf-drawer-icon" />
                <span className="tf-drawer-title">AI Milestone Breakdown</span>
              </div>
              <span className="tf-drawer-subtitle">
                Select actionable milestones to import into your workspace
              </span>
            </div>

            {loadingInlineBreakdown ? (
              <div className="tf-drawer-loading">
                <FiRefreshCw className="spin" />
                <span>Decomposing goal with neural planner...</span>
              </div>
            ) : inlineSubtasks.length === 0 ? (
              <div className="tf-drawer-empty">
                <span>No milestones generated for this task.</span>
              </div>
            ) : (
              <div className="tf-drawer-subtasks-list">
                {inlineSubtasks.map((sub, idx) => (
                  <label key={sub.id || idx} className="tf-subtask-item">
                    <input
                      type="checkbox"
                      checked={sub.selected}
                      onChange={() => toggleSubtaskCheck(idx)}
                      className="tf-subtask-check"
                    />
                    <span className="tf-subtask-text">{sub.task}</span>
                    <span className={`tf-subtask-prio ${(sub.priority || "Medium").toLowerCase()}`}>
                      {sub.priority}
                    </span>
                  </label>
                ))}

                <div className="tf-drawer-actions">
                  <button
                    type="button"
                    className="tf-btn-import-subtasks"
                    onClick={addInlineSubtasks}
                    disabled={addingInlineSubtasks}
                  >
                    {addingInlineSubtasks ? (
                      <>
                        <FiRefreshCw className="spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <FiPlus />
                        <span>Import Selected ({inlineSubtasks.filter((s) => s.selected).length})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="tf-btn-cancel-drawer"
                    onClick={() => toggleInlineBreakdown(taskItem)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`taskflow-app-shell ${darkMode ? "dark-theme" : "light-theme"}`}>
      {/* =========================================================================
          1. COMPACT SIDEBAR NAVIGATION (Collapsible)
          ========================================================================= */}
      <aside className={`tf-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* Brand Header */}
        <div className="tf-sidebar-brand">
          <div className="tf-brand-mark" title="TaskFlow">
            <FiZap className="tf-brand-icon" />
          </div>
          {!sidebarCollapsed && (
            <div className="tf-brand-text">
              <span className="tf-brand-title">TaskFlow</span>
              <span className="tf-brand-badge">Workspace</span>
            </div>
          )}
          <button
            type="button"
            className="tf-sidebar-collapse-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="tf-sidebar-nav" aria-label="Main Navigation">
          <div className="tf-nav-group-label">{!sidebarCollapsed && "CORE"}</div>

          <button
            type="button"
            className={`tf-nav-item ${activeView === "overview" ? "active" : ""}`}
            onClick={() => changeView("overview")}
            title="Overview (⌘1)"
          >
            <FiGrid className="tf-nav-icon" />
            {!sidebarCollapsed && <span className="tf-nav-label">Overview</span>}
            {!sidebarCollapsed && <span className="tf-kbd-hint">⌘1</span>}
          </button>

          <button
            type="button"
            className={`tf-nav-item ${activeView === "tasks" ? "active" : ""}`}
            onClick={() => changeView("tasks")}
            title="My Tasks (⌘2)"
          >
            <FiCheckSquare className="tf-nav-icon" />
            {!sidebarCollapsed && <span className="tf-nav-label">My Tasks</span>}
            {!sidebarCollapsed && activeTasks > 0 && (
              <span className="tf-nav-counter">{activeTasks}</span>
            )}
          </button>

          <button
            type="button"
            className={`tf-nav-item ${activeView === "favorites" ? "active" : ""}`}
            onClick={() => changeView("favorites")}
            title="Favorites (⌘3)"
          >
            <FiStar className="tf-nav-icon" />
            {!sidebarCollapsed && <span className="tf-nav-label">Favorites</span>}
            {!sidebarCollapsed && favoriteTasksCount > 0 && (
              <span className="tf-nav-counter gold">{favoriteTasksCount}</span>
            )}
          </button>

          <div className="tf-nav-group-label">{!sidebarCollapsed && "INTELLIGENCE"}</div>

          <button
            type="button"
            className={`tf-nav-item ${activeView === "planner" ? "active" : ""}`}
            onClick={() => changeView("planner")}
            title="AI Planner (⌘4)"
          >
            <FiCalendar className="tf-nav-icon" />
            {!sidebarCollapsed && <span className="tf-nav-label">AI Planner</span>}
            {!sidebarCollapsed && <span className="tf-kbd-hint">⌘4</span>}
          </button>

          <button
            type="button"
            className={`tf-nav-item ${activeView === "reschedule" ? "active" : ""}`}
            onClick={() => changeView("reschedule")}
            title="Smart Rescheduling (⌘5)"
          >
            <FiRefreshCw className="tf-nav-icon" />
            {!sidebarCollapsed && <span className="tf-nav-label">Smart Rescheduling</span>}
            {!sidebarCollapsed && overdueTasks > 0 && (
              <span className="tf-nav-counter alert">{overdueTasks}</span>
            )}
          </button>

          <button
            type="button"
            className={`tf-nav-item ${activeView === "intelligence" ? "active" : ""}`}
            onClick={() => changeView("intelligence")}
            title="Productivity Insights (⌘6)"
          >
            <FiTrendingUp className="tf-nav-icon" />
            {!sidebarCollapsed && <span className="tf-nav-label">Productivity Insights</span>}
            {!sidebarCollapsed && <span className="tf-kbd-hint">⌘6</span>}
          </button>

          <div className="tf-nav-group-label">{!sidebarCollapsed && "ACCOUNT"}</div>

          <button
            type="button"
            className={`tf-nav-item ${activeView === "profile" ? "active" : ""}`}
            onClick={() => changeView("profile")}
            title="Profile & Account Settings (⌘7)"
          >
            <FiUser className="tf-nav-icon" />
            {!sidebarCollapsed && <span className="tf-nav-label">Profile & Security</span>}
            {!sidebarCollapsed && <span className="tf-kbd-hint">⌘7</span>}
          </button>
        </nav>

        {/* Workspaces Section */}
        {!sidebarCollapsed && (
          <div className="tf-workspaces-section">
            <div className="tf-workspaces-header">
              <span className="tf-nav-group-label">WORKSPACES</span>
              <button
                type="button"
                className="tf-btn-add-workspace"
                onClick={() => setShowAddWorkspaceModal(true)}
                title="Create New Workspace"
                aria-label="Create New Workspace"
              >
                <FiPlus />
              </button>
            </div>
            <div className="tf-workspace-list">
              {userWorkspaces.map((ws) => {
                const isActive = activeWorkspace === ws.id;
                const count = getWorkspaceTaskCount(ws.id);
                return (
                  <button
                    key={ws.id}
                    type="button"
                    className={`tf-workspace-item ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectWorkspace(ws.id)}
                    title={`Switch to ${ws.name} (${count} tasks)`}
                    aria-selected={isActive}
                  >
                    <span
                      className={`tf-workspace-dot ${ws.dotClass || ""}`}
                      style={ws.color ? { backgroundColor: ws.color } : {}}
                    />
                    <span className="tf-workspace-name">{ws.name}</span>
                    <span className="tf-workspace-count">{count}</span>
                    {isActive ? (
                      <span className="tf-workspace-active-badge">Active</span>
                    ) : (
                      ws.custom && (
                        <button
                          type="button"
                          className="tf-workspace-delete-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkspace(ws.id, ws.name);
                          }}
                          title={`Delete ${ws.name} workspace`}
                          aria-label={`Delete ${ws.name} workspace`}
                        >
                          <FiTrash2 />
                        </button>
                      )
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* User Profile & Theme Action at Bottom */}
        <div className="tf-sidebar-footer">
          <div
            className="tf-user-profile-card clickable"
            onClick={() => changeView("profile")}
            title="Open Account & Profile Settings"
            role="button"
            tabIndex={0}
          >
            <div className="tf-user-avatar" title={userName}>
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="tf-avatar-img" />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="tf-user-info">
                <span className="tf-user-name">{userName}</span>
                <span className="tf-user-role">Account Settings</span>
              </div>
            )}
            <button
              type="button"
              className="tf-btn-logout-icon"
              onClick={(e) => {
                e.stopPropagation();
                setShowLogoutModal(true);
              }}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <FiLogOut />
            </button>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN CANVAS AREA (Top Nav + Scrollable Content)
          ========================================================================= */}
      <div className="tf-main-canvas">
        {/* TOP NAVIGATION BAR — APPLE macOS / SONOMA TRANSLUCENT WORKSPACE TOOLBAR */}
        <header className="tf-top-bar" role="banner">
          <div className="tf-top-left">
            <nav className="tf-apple-nav-crumbs" aria-label="Breadcrumb">
              <div className="tf-apple-workspace-wrapper" ref={workspaceDropdownRef}>
                <button
                  type="button"
                  className="tf-apple-workspace-pill clickable"
                  onClick={() => setShowWorkspaceDropdown((prev) => !prev)}
                  title={`Current Workspace: ${currentWorkspaceObj.name}. Click to switch.`}
                  aria-expanded={showWorkspaceDropdown}
                >
                  <span
                    className={`tf-workspace-dot ${currentWorkspaceObj.dotClass || ""}`}
                    style={currentWorkspaceObj.color ? { backgroundColor: currentWorkspaceObj.color } : {}}
                  />
                  <span className="tf-apple-workspace-name">{currentWorkspaceObj.name}</span>
                  <FiChevronDown className="tf-workspace-pill-chevron" />
                </button>

                {showWorkspaceDropdown && (
                  <div className="tf-workspace-dropdown-menu" role="menu">
                    <div className="tf-dropdown-header">Switch Workspace</div>
                    {userWorkspaces.map((ws) => (
                      <button
                        key={ws.id}
                        type="button"
                        className={`tf-dropdown-item ${activeWorkspace === ws.id ? "active" : ""}`}
                        onClick={() => handleSelectWorkspace(ws.id)}
                        role="menuitem"
                      >
                        <span
                          className={`tf-workspace-dot ${ws.dotClass || ""}`}
                          style={ws.color ? { backgroundColor: ws.color } : {}}
                        />
                        <span className="tf-dropdown-item-name">{ws.name}</span>
                        <span className="tf-dropdown-item-count">{getWorkspaceTaskCount(ws.id)}</span>
                        {activeWorkspace === ws.id && <FiCheck className="tf-dropdown-check" />}
                      </button>
                    ))}
                    <div className="tf-dropdown-divider" />
                    <button
                      type="button"
                      className="tf-dropdown-item tf-dropdown-add-action"
                      onClick={() => {
                        setShowWorkspaceDropdown(false);
                        setShowAddWorkspaceModal(true);
                      }}
                      role="menuitem"
                    >
                      <FiPlus className="tf-dropdown-add-icon" />
                      <span>New Workspace...</span>
                    </button>
                  </div>
                )}
              </div>
              <FiChevronRight className="tf-apple-crumb-chevron" aria-hidden="true" />
              <div className="tf-apple-active-view-pill">
                {activeView === "overview" && (
                  <>
                    <FiGrid className="tf-apple-view-icon" aria-hidden="true" />
                    <span className="tf-apple-view-title">Overview</span>
                  </>
                )}
                {activeView === "tasks" && (
                  <>
                    <FiCheckSquare className="tf-apple-view-icon" aria-hidden="true" />
                    <span className="tf-apple-view-title">My Tasks</span>
                  </>
                )}
                {activeView === "favorites" && (
                  <>
                    <FiStar className="tf-apple-view-icon" aria-hidden="true" />
                    <span className="tf-apple-view-title">Favorites</span>
                  </>
                )}
                {activeView === "planner" && (
                  <>
                    <FiCalendar className="tf-apple-view-icon" aria-hidden="true" />
                    <span className="tf-apple-view-title">Daily Planner</span>
                  </>
                )}
                {activeView === "reschedule" && (
                  <>
                    <FiRefreshCw className="tf-apple-view-icon" aria-hidden="true" />
                    <span className="tf-apple-view-title">Smart Rescheduling</span>
                  </>
                )}
                {activeView === "intelligence" && (
                  <>
                    <FiTrendingUp className="tf-apple-view-icon" aria-hidden="true" />
                    <span className="tf-apple-view-title">Productivity Intelligence</span>
                  </>
                )}
                {activeView === "profile" && (
                  <>
                    <FiUser className="tf-apple-view-icon" aria-hidden="true" />
                    <span className="tf-apple-view-title">Account & Profile</span>
                  </>
                )}
              </div>
            </nav>
          </div>

          {/* Central Apple Spotlight / Unified Command Search Pill */}
          <div className="tf-top-center">
            <button
              type="button"
              className="tf-apple-search-trigger"
              onClick={() => setShowAiConsole(true)}
              title="Search tasks or command (⌘K or /)"
              aria-label="Search tasks or run AI command"
            >
              <FiSearch className="tf-apple-search-icon" aria-hidden="true" />
              <span className="tf-apple-search-placeholder">Search or jump to...</span>
              <kbd className="tf-apple-keycap" aria-label="Command K shortcut">
                <span className="tf-apple-key-symbol">⌘</span>
                <span className="tf-apple-key-char">K</span>
              </kbd>
            </button>
          </div>

          <div className="tf-top-right">
            {/* Apple Live Status Pill */}
            {backendError ? (
              <button
                type="button"
                className="tf-apple-status-capsule error"
                onClick={getTasks}
                title={`${backendError} (Click to retry)`}
                aria-label="Backend offline, click to retry"
              >
                <span className="tf-apple-status-dot offline" aria-hidden="true" />
                <span className="tf-apple-status-text">Offline</span>
              </button>
            ) : (
              <div
                className={`tf-apple-status-capsule ${overdueTasks > 0 ? "alert" : "good"}`}
                role="status"
                aria-live="polite"
                title={
                  overdueTasks > 0
                    ? `${overdueTasks} task${overdueTasks === 1 ? "" : "s"} overdue`
                    : activeTasks > 0
                    ? `${activeTasks} active task${activeTasks === 1 ? "" : "s"} on track`
                    : "All tasks completed"
                }
              >
                <span className={`tf-apple-status-dot ${overdueTasks > 0 ? "alert" : "good"}`} aria-hidden="true" />
                <span className="tf-apple-status-text">
                  {overdueTasks > 0
                    ? `${overdueTasks} overdue`
                    : activeTasks > 0
                    ? `${activeTasks} active`
                    : "All clear"}
                </span>
              </div>
            )}

            {/* Apple Control Center Theme Toggle */}
            <button
              type="button"
              className="tf-apple-theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {darkMode ? <FiSun className="tf-apple-theme-icon sun" /> : <FiMoon className="tf-apple-theme-icon moon" />}
            </button>

            {/* Quick Profile Settings Action Button */}
            <button
              type="button"
              className={`tf-apple-profile-btn ${activeView === "profile" ? "active" : ""}`}
              onClick={() => changeView("profile")}
              title={`Account & Profile (${userName})`}
              aria-label="Account Settings"
            >
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="tf-apple-avatar-img" />
              ) : (
                <span className="tf-apple-avatar-initial">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            <div className="tf-apple-separator" aria-hidden="true" />

            {/* Apple Vibrant Primary Action — New Task */}
            <button
              type="button"
              className="tf-apple-btn-primary"
              onClick={() => setShowAddTaskModal(true)}
              title="Create new task (Hotkey: C)"
              aria-label="Create new task"
            >
              <FiPlus className="tf-apple-btn-icon" aria-hidden="true" />
              <span className="tf-apple-btn-text">New Task</span>
              <kbd className="tf-apple-btn-kbd">C</kbd>
            </button>
          </div>
        </header>

        {/* =====================================================================
            3. WORKSPACE VIEWS (Overview / Tasks / Favorites / Planner / etc.)
            ===================================================================== */}
        <main className="tf-content-body">
          {/* VIEW 1: OVERVIEW — CINEMATIC FOCUS HORIZON */}
          {activeView === "overview" && (
            <div className="tf-overview-canvas">
              {/* HERO SECTION WITH ATMOSPHERIC SCENIC ARTWORK */}
              <section className="tf-hero-banner">
                {/* Embedded Atmospheric Mountain Vector Graphic */}
                <div
                  className="tf-hero-scenic-backdrop"
                  style={{
                    backgroundImage: `url(${darkMode ? heroMountainsDark : heroMountainsLight})`,
                  }}
                  aria-hidden="true"
                />
                <div className="tf-hero-overlay" aria-hidden="true" />

                <div className="tf-hero-content">
                  {/* Editorial Date & Greeting */}
                  <div className="tf-hero-eyebrow">
                    <span className="tf-hero-date-badge">{formattedDate}</span>
                  </div>

                  <h1 className="tf-hero-greeting">
                    {contextualGreeting}, <span className="tf-greeting-name">{userFirstName}</span>
                  </h1>

                  <p className="tf-hero-summary">{editorialSummary}</p>

                  {/* PROMINENT GEMINI AI COMMAND CENTRE */}
                  <div className="tf-ai-command-centre tf-gemini-command-centre">
                    <form onSubmit={handleHeroAiSubmit} className="tf-ai-form">
                      <div className="tf-ai-input-wrapper tf-gemini-input-wrapper">
                        <div className="tf-ai-sparkle-badge tf-gemini-sparkle-badge" aria-hidden="true" title="TaskFlow AI">
                          <TaskFlowSymbol size={20} fill={darkMode ? "#ffffff" : "#7c3aed"} glow />
                        </div>
                        <input
                          type="text"
                          className="tf-ai-input tf-gemini-input"
                          placeholder="Ask TaskFlow anything... (e.g., 'Clean my room', 'DSA exam in 3 days', 'Build a React website')"
                          value={aiInputText}
                          onChange={(e) => setAiInputText(e.target.value)}
                          disabled={aiLoading}
                        />

                        {/* Configure Drawer Toggle */}
                        <button
                          type="button"
                          className={`tf-ai-btn-config tf-gemini-btn-config ${aiConfigOpen ? "active" : ""}`}
                          onClick={() => setAiConfigOpen((prev) => !prev)}
                          title="Configure task attributes or add single task"
                        >
                          <FiSliders />
                          <span>Configure</span>
                        </button>

                        {/* Ask TaskFlow Button */}
                        <button
                          type="submit"
                          className="tf-ai-btn-submit tf-gemini-btn-submit"
                          disabled={aiLoading || !aiInputText.trim()}
                        >
                          {aiLoading ? (
                            <>
                              <FiRefreshCw className="spin" />
                              <span>Generating with AI...</span>
                            </>
                          ) : (
                            <>
                              <TaskFlowSymbol size={15} fill="#ffffff" />
                              <span>Ask TaskFlow</span>
                            </>
                          )}
                        </button>

                        {/* Open Taskflow agent Button */}
                        <button
                          type="button"
                          className="tf-ai-btn-open-chat"
                          onClick={() => setShowAiChat(true)}
                          title="Open interactive Taskflow agent"
                        >
                          <span>💬 Taskflow agent</span>
                        </button>
                      </div>

                      {/* Expandable Configure Controls */}
                      {aiConfigOpen && (
                        <div className="tf-ai-config-drawer tf-gemini-config-drawer">
                          <div className="tf-config-controls-group">
                            <div className="tf-config-item">
                              <label htmlFor="hero-priority-select">
                                <FiFlag size={12} aria-hidden="true" />
                                <span>Priority:</span>
                              </label>
                              <select
                                id="hero-priority-select"
                                value={aiConfigPriority}
                                onChange={(e) => setAiConfigPriority(e.target.value)}
                                className="tf-config-select"
                              >
                                <option value="High">🔴 High</option>
                                <option value="Medium">🟡 Medium</option>
                                <option value="Low">🟢 Low</option>
                              </select>
                            </div>

                            <div className="tf-config-item">
                              <label htmlFor="hero-due-input">
                                <FiCalendar size={12} aria-hidden="true" />
                                <span>Due Date:</span>
                              </label>
                              <input
                                id="hero-due-input"
                                type="date"
                                value={aiConfigDueDate}
                                onChange={(e) => setAiConfigDueDate(e.target.value)}
                                className="tf-config-date"
                              />
                            </div>

                            <button
                              type="button"
                              className="tf-btn-quick-single-task"
                              onClick={handleHeroSingleTaskCreate}
                              disabled={aiLoading || !aiInputText.trim()}
                              title="Add directly as a single task without generating a plan"
                            >
                              <FiPlus size={13} aria-hidden="true" />
                              <span>Add as Single Task</span>
                            </button>
                          </div>

                          <div className="tf-config-note-pill">
                            <span className="tf-sparkle-mini">✦</span>
                            <span>Default creates full strategic action plan</span>
                          </div>
                        </div>
                      )}

                      {/* Example Prompt Chips */}
                      <div className="tf-ai-prompt-chips tf-gemini-prompt-chips">
                        <span className="tf-chips-label tf-gemini-chips-label">
                          <span className="tf-gemini-label-sparkle">✦</span> Try asking:
                        </span>
                        {PROMPT_SUGGESTIONS.map((prompt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="tf-prompt-chip tf-gemini-chip"
                            onClick={() => {
                              setAiInputText(prompt);
                              setAiConfigOpen(false);
                            }}
                          >
                            <span className="tf-chip-sparkle-dot">✦</span>
                            <span>{prompt}</span>
                          </button>
                        ))}
                      </div>
                    </form>
                  </div>
                </div>
              </section>

              {/* VISUALLY UNIFIED PRODUCTIVITY OVERVIEW DECK */}
              <section className="tf-metrics-deck" aria-label="Productivity Metrics">
                {/* Visual Proportional Load Spectrum Bar */}
                <div className="tf-deck-spectrum-bar" title="Task Load Proportions">
                  <div
                    className="tf-deck-segment seg-overdue"
                    style={{ width: `${totalTasks ? (overdueTasks / totalTasks) * 100 : 0}%` }}
                    title={`Overdue: ${overdueTasks}`}
                  />
                  <div
                    className="tf-deck-segment seg-today"
                    style={{ width: `${totalTasks ? (tasksDueTodayCount / totalTasks) * 100 : 0}%` }}
                    title={`Due Today: ${tasksDueTodayCount}`}
                  />
                  <div
                    className="tf-deck-segment seg-active"
                    style={{
                      width: `${
                        totalTasks
                          ? (Math.max(activeTasks - overdueTasks - tasksDueTodayCount, 0) / totalTasks) * 100
                          : 0
                      }%`,
                    }}
                    title={`Active Backlog: ${activeTasks}`}
                  />
                  <div
                    className="tf-deck-segment seg-completed"
                    style={{ width: `${completionPercentage}%` }}
                    title={`Completed: ${completedTasks}`}
                  />
                </div>

                <div className="tf-deck-cells-row">
                  {/* Cell 1: Active Backlog */}
                  <div className="tf-deck-cell">
                    <span className="tf-deck-cell-tag">ACTIVE BACKLOG</span>
                    <div className="tf-deck-cell-stat">
                      <span className="tf-deck-num">{activeTasks}</span>
                      <span className="tf-deck-desc">tasks awaiting execution</span>
                    </div>
                  </div>

                  <div className="tf-deck-divider" aria-hidden="true" />

                  {/* Cell 2: Due Today & Overdue */}
                  <div className={`tf-deck-cell ${overdueTasks > 0 ? "has-urgent" : ""}`}>
                    <span className="tf-deck-cell-tag">DUE TODAY & OVERDUE</span>
                    <div className="tf-deck-cell-stat">
                      <span className="tf-deck-num">{tasksDueTodayCount}</span>
                      {overdueTasks > 0 ? (
                        <span className="tf-deck-tag-urgent">{overdueTasks} Overdue</span>
                      ) : (
                        <span className="tf-deck-desc">scheduled for today</span>
                      )}
                    </div>
                  </div>

                  <div className="tf-deck-divider" aria-hidden="true" />

                  {/* Cell 3: Weekly Velocity */}
                  <div className="tf-deck-cell">
                    <span className="tf-deck-cell-tag">WEEKLY VELOCITY</span>
                    <div className="tf-deck-cell-stat">
                      <span className="tf-deck-num">{tasksCompletedThisWeek}</span>
                      <span className="tf-deck-desc">completed past 7 days</span>
                    </div>
                  </div>

                  <div className="tf-deck-divider" aria-hidden="true" />

                  {/* Cell 4: Completion Momentum */}
                  <div className="tf-deck-cell">
                    <span className="tf-deck-cell-tag">COMPLETION MOMENTUM</span>
                    <div className="tf-deck-cell-stat">
                      <span className="tf-deck-num">{completionPercentage}%</span>
                      <span className="tf-deck-desc">{completedTasks} of {totalTasks} finished</span>
                    </div>
                  </div>

                  {/* Contextual Quick Actions */}
                  <div className="tf-deck-actions">
                    {overdueTasks > 0 && (
                      <button
                        type="button"
                        className="tf-deck-btn-reschedule"
                        onClick={() => changeView("reschedule")}
                        title="Launch AI-assisted schedule rebalancer"
                      >
                        <FiRefreshCw />
                        <span>Smart Reschedule</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="tf-deck-btn-planner"
                      onClick={() => changeView("planner")}
                      title="Launch AI Daily Focus Planner"
                    >
                      <FiCalendar />
                      <span>Synthesize Day</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* TWO-COLUMN TASK WORKSPACE */}
              <div className="tf-workspace-grid">
                {/* LEFT MAIN COLUMN: CRITICAL PATH TASK AREA */}
                <div className="tf-critical-path-column">
                  {/* Column Header & Filter Tabs */}
                  <div className="tf-column-header">
                    <div className="tf-column-title-wrap">
                      <h2 className="tf-column-title">Today's Priorities & Active Tasks</h2>
                      <span className="tf-column-badge">{filteredCriticalTasks.length}</span>
                    </div>

                    <div className="tf-column-controls">
                      {/* Filter Tabs */}
                      <div className="tf-filter-pills">
                        <button
                          type="button"
                          className={`tf-filter-pill ${overviewTaskFilter === "all" ? "active" : ""}`}
                          onClick={() => setOverviewTaskFilter("all")}
                        >
                          All ({tasks.length})
                        </button>
                        <button
                          type="button"
                          className={`tf-filter-pill ${overviewTaskFilter === "active" ? "active" : ""}`}
                          onClick={() => setOverviewTaskFilter("active")}
                        >
                          Active ({activeTasks})
                        </button>
                        <button
                          type="button"
                          className={`tf-filter-pill ${overviewTaskFilter === "today" ? "active" : ""}`}
                          onClick={() => setOverviewTaskFilter("today")}
                        >
                          Today ({tasksDueTodayCount})
                        </button>
                        <button
                          type="button"
                          className={`tf-filter-pill ${overviewTaskFilter === "high" ? "active" : ""}`}
                          onClick={() => setOverviewTaskFilter("high")}
                        >
                          High ({highPriorityCount})
                        </button>
                      </div>

                      {/* Day-Wise vs Flat Grouping Switcher */}
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
                          title="Show flat chronological list"
                        >
                          <FiLayers aria-hidden="true" />
                          <span>Flat</span>
                        </button>
                      </div>

                      {/* Focus Mode Toggle */}
                      <button
                        type="button"
                        className={`tf-btn-focus-mode ${focusMode ? "active" : ""}`}
                        onClick={() => setFocusMode((prev) => !prev)}
                        title="Focus Mode: Isolate urgent and high-priority items"
                      >
                        <span className="tf-focus-dot" />
                        <span>{focusMode ? "Focus Active" : "Focus Mode"}</span>
                      </button>

                      {/* Delete All / Clear Tasks Button */}
                      {tasks.length > 0 && (
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
                      )}
                    </div>
                  </div>

                  {/* Inline Quick Add Task Command Bar */}
                  <form
                    onSubmit={handleQuickAdd}
                    className="tf-inline-quick-add"
                    role="search"
                    aria-label="Quick add task command bar"
                  >
                    <div className="tf-quick-input-wrap">
                      <div className="tf-quick-icon-badge" aria-hidden="true">
                        <FiPlus className="tf-quick-icon" />
                      </div>
                      <input
                        type="text"
                        className="tf-quick-input"
                        placeholder="Quickly add a task to your critical path..."
                        value={quickTaskTitle}
                        onChange={(e) => setQuickTaskTitle(e.target.value)}
                        disabled={isSubmittingQuick}
                        autoComplete="off"
                        spellCheck="false"
                      />
                      <div className="tf-quick-shortcut-hint" aria-hidden="true">
                        <kbd className="tf-quick-kbd">↵ Enter</kbd>
                      </div>
                    </div>

                    <div className="tf-quick-actions">
                      <div
                        className={`tf-quick-priority-pill-wrapper ${isQuickPriorityOpen ? "open" : ""}`}
                        ref={quickPriorityRef}
                      >
                        <button
                          type="button"
                          className={`tf-quick-priority-pill tf-priority-${(quickTaskPriority || "Medium").toLowerCase()} ${isQuickPriorityOpen ? "active" : ""}`}
                          onClick={() => !isSubmittingQuick && setIsQuickPriorityOpen((prev) => !prev)}
                          disabled={isSubmittingQuick}
                          aria-haspopup="listbox"
                          aria-expanded={isQuickPriorityOpen}
                          aria-label={`Select Priority, currently ${quickTaskPriority}`}
                        >
                          <span className="tf-quick-priority-dot" aria-hidden="true" />
                          <span className="tf-quick-priority-label">{quickTaskPriority}</span>
                          <FiChevronDown
                            className={`tf-quick-select-chevron ${isQuickPriorityOpen ? "rotated" : ""}`}
                            aria-hidden="true"
                          />
                        </button>

                        {/* Hidden input for form fallback */}
                        <input type="hidden" name="priority" value={quickTaskPriority} />

                        {isQuickPriorityOpen && (
                          <div
                            className="tf-quick-priority-menu"
                            role="listbox"
                            aria-label="Priority Options"
                          >
                            <div className="tf-quick-priority-menu-header">Priority</div>
                            {QUICK_PRIORITY_OPTIONS.map((opt) => {
                              const isSelected = quickTaskPriority === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  className={`tf-quick-priority-option ${isSelected ? "selected" : ""} ${opt.dotClass}`}
                                  onClick={() => {
                                    setQuickTaskPriority(opt.value);
                                    setIsQuickPriorityOpen(false);
                                  }}
                                >
                                  <div className="tf-quick-option-left">
                                    <span className="tf-quick-option-dot" aria-hidden="true" />
                                    <span className="tf-quick-option-text">{opt.label}</span>
                                  </div>
                                  {isSelected && (
                                    <FiCheck className="tf-quick-option-check" aria-hidden="true" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="tf-quick-submit-btn"
                        disabled={isSubmittingQuick || !quickTaskTitle.trim()}
                        title="Add Task to Critical Path (Enter)"
                        aria-label="Add Task"
                      >
                        {isSubmittingQuick ? (
                          <span className="tf-quick-submit-spinner" aria-hidden="true" />
                        ) : (
                          <FiPlus className="tf-quick-btn-icon" aria-hidden="true" />
                        )}
                        <span className="tf-quick-btn-text">
                          {isSubmittingQuick ? "Adding..." : "Add Task"}
                        </span>
                      </button>
                    </div>
                  </form>

                  {/* Task Rows List */}
                  <div className="tf-task-rows-container">
                    {backendError && tasks.length === 0 ? (
                      <div className="tf-connection-error-card" role="alert">
                        <FiAlertTriangle className="tf-error-icon" />
                        <span className="tf-error-title">Backend Connection Unavailable</span>
                        <p className="tf-error-desc">
                          {backendError}
                        </p>
                        <div className="tf-error-actions">
                          <button
                            type="button"
                            className="tf-btn-retry"
                            onClick={getTasks}
                            disabled={loadingTasks}
                          >
                            <FiRefreshCw className={loadingTasks ? "spin" : ""} />
                            <span>{loadingTasks ? "Connecting..." : "Retry Connection"}</span>
                          </button>
                        </div>
                      </div>
                    ) : loadingTasks && tasks.length === 0 ? (
                      <div className="tf-loading-tasks-card">
                        <div className="tf-skeleton-row shimmer" />
                        <div className="tf-skeleton-row shimmer" />
                        <div className="tf-skeleton-row shimmer" />
                      </div>
                    ) : filteredCriticalTasks.length === 0 ? (
                      <div className="tf-empty-tasks">
                        <FiCheckCircle className="tf-empty-icon" />
                        <span className="tf-empty-title">
                          {tasks.length > 0 && activeWorkspace !== "all"
                            ? `No tasks in "${currentWorkspaceObj?.name || 'this workspace'}"`
                            : "All priorities are clear!"}
                        </span>
                        <div className="tf-empty-desc">
                          {tasks.length > 0 && activeWorkspace !== "all" ? (
                            <>
                              <span>You have {tasks.length} total task{tasks.length === 1 ? "" : "s"} across your workspaces.</span>
                              <div style={{ marginTop: "12px", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  className="tf-btn-quick-single-task"
                                  onClick={() => handleSelectWorkspace("all")}
                                >
                                  View All Tasks ({tasks.length})
                                </button>
                                <button
                                  type="button"
                                  className="tf-btn-quick-single-task"
                                  onClick={() => handleSelectWorkspace("engineering")}
                                >
                                  Switch to Engineering Core
                                </button>
                              </div>
                            </>
                          ) : focusMode ? (
                            "No urgent or high-priority items need intervention in Focus Mode."
                          ) : (
                            "You have no tasks matching this filter. Use the AI Command Centre above to create one."
                          )}
                        </div>
                      </div>
                    ) : (
                      taskGrouping === "day" ? (
                        groupedCriticalTasksByDay.map((group) => (
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
                              {group.tasks.map(renderOverviewTaskCard)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="tf-flat-tasks-list">
                          {filteredCriticalTasks.map(renderOverviewTaskCard)}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* RIGHT SIDEBAR COLUMN: CONTEXT, DEADLINES & WEEKLY PROGRESS */}
                <div className="tf-side-intelligence-column">
                  {/* CARD 1: UPCOMING DEADLINES */}
                  <div className="tf-side-card">
                    <div className="tf-side-card-header">
                      <div className="tf-side-card-title">
                        <FiClock className="tf-side-icon" />
                        <span>Upcoming Deadlines</span>
                      </div>
                      <span className="tf-side-badge">{upcomingDeadlines.length}</span>
                    </div>

                    <div className="tf-deadlines-list">
                      {upcomingDeadlines.length === 0 ? (
                        <div className="tf-side-empty">
                          <FiCheckCircle className="tf-side-empty-icon" />
                          <span>No upcoming deadlines scheduled</span>
                        </div>
                      ) : (
                        upcomingDeadlines.map((task) => {
                          const dueInfo = formatDueDate(task.dueDate, false);
                          return (
                            <div key={task.id} className="tf-deadline-item">
                              <div className="tf-deadline-info">
                                <span className="tf-deadline-task">{task.task || task.title}</span>
                                <span className={`tf-deadline-priority ${(task.priority || "Medium").toLowerCase()}`}>
                                  {task.priority || "Medium"}
                                </span>
                              </div>
                              {dueInfo && (
                                <span className={`tf-deadline-pill ${dueInfo.statusClass}`}>
                                  {dueInfo.label}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* CARD 2: WEEKLY PROGRESS VISUALIZATION */}
                  <div className="tf-side-card">
                    <div className="tf-side-card-header">
                      <div className="tf-side-card-title">
                        <FiTrendingUp className="tf-side-icon" />
                        <span>Weekly Velocity Progress</span>
                      </div>
                      <span className="tf-side-stat-pill">{tasksCompletedThisWeek} this week</span>
                    </div>

                    {/* 7-Day Mini Bar Chart */}
                    <div className="tf-weekly-chart-container">
                      <div className="tf-chart-bars">
                        {weeklyProgressData.map((d, idx) => {
                          const heightPct = Math.round((d.count / maxWeeklyProgress) * 100);
                          return (
                            <div key={idx} className="tf-chart-col" title={`${d.fullDay}: ${d.count} tasks completed`}>
                              <div className="tf-chart-bar-track">
                                <div
                                  className="tf-chart-bar-fill"
                                  style={{ height: `${d.count > 0 ? Math.max(heightPct, 15) : 4}%` }}
                                />
                              </div>
                              <span className="tf-chart-day-label">{d.dayName}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="tf-weekly-summary-row">
                        <span className="tf-summary-label">Target: 4 tasks / day</span>
                        <span className="tf-summary-status">
                          {tasksCompletedThisWeek >= 10 ? "Exceeding Velocity 🚀" : "Consistent Cadence"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: AI PLANNER & RESCHEDULE ENTRY POINT */}
                  <div className="tf-side-card planner-spotlight">
                    <div className="tf-planner-card-badge">
                      <FiZap />
                      <span>Intelligent Workflows</span>
                    </div>
                    <h3 className="tf-planner-card-title">AI Day Synthesizer & Scheduler</h3>
                    <p className="tf-planner-card-desc">
                      Organize your pending backlog into realistic focus blocks or rebalance overdue deadlines automatically.
                    </p>

                    <div className="tf-planner-card-actions">
                      <button
                        type="button"
                        className="tf-btn-launch-planner"
                        onClick={() => changeView("planner")}
                      >
                        <FiCalendar />
                        <span>Open Daily Planner</span>
                        <FiArrowRight />
                      </button>

                      {overdueTasks > 0 && (
                        <button
                          type="button"
                          className="tf-btn-launch-reschedule"
                          onClick={() => changeView("reschedule")}
                        >
                          <FiRefreshCw />
                          <span>Resolve Overdue ({overdueTasks})</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: MY TASKS (Full Catalog & Sprint Matrix) */}
          {activeView === "tasks" && (
            <div className="tf-tasks-catalog-view">
              <div className="tf-catalog-toolbar">
                <div className="tf-view-mode-toggle">
                  <button
                    type="button"
                    className={`tf-toggle-mode-btn ${tasksViewMode === "stream" ? "active" : ""}`}
                    onClick={() => setTasksViewMode("stream")}
                  >
                    <FiLayers />
                    <span>Stream Catalog</span>
                  </button>
                  <button
                    type="button"
                    className={`tf-toggle-mode-btn ${tasksViewMode === "matrix" ? "active" : ""}`}
                    onClick={() => setTasksViewMode("matrix")}
                  >
                    <FiSliders />
                    <span>Eisenhower Matrix</span>
                  </button>
                </div>

                <div className="tf-search-bar-wrap">
                  <SearchBar search={search} setSearch={setSearch} />
                </div>

                <div className="tf-filter-selects">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="tf-select-control"
                    aria-label="Filter status"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active Only</option>
                    <option value="completed">Completed</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="tf-select-control"
                    aria-label="Filter priority"
                  >
                    <option value="all">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="tf-select-control"
                    aria-label="Sort order"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="dueDate">Due Date</option>
                    <option value="priority">Priority</option>
                  </select>
                </div>
              </div>

              {tasksViewMode === "stream" ? (
                <div className="tf-stream-table-wrap">
                  <TaskList
                    tasks={displayedTasks}
                    getTasks={getTasks}
                    deleteTask={deleteTask}
                    toggleTask={toggleTask}
                    toggleFavorite={toggleFavorite}
                    updateTask={updateTask}
                    search={search}
                    filter={filter}
                    priorityFilter={priorityFilter}
                    loading={loadingTasks}
                    backendError={backendError}
                    onRetry={getTasks}
                    workspaces={userWorkspaces.filter((w) => w.id !== "all")}
                  />
                </div>
              ) : (
                <div className="tf-eisenhower-grid">
                  <div className="tf-quadrant q1">
                    <div className="tf-quadrant-header">
                      <span className="tf-quad-tag q1">DO FIRST</span>
                      <h4>Urgent & High Impact</h4>
                      <span className="tf-quad-count">{eisenhowerQuadrants.q1.length}</span>
                    </div>
                    <div className="tf-quad-items">
                      {eisenhowerQuadrants.q1.map((t) => (
                        <div key={t.id} className="tf-quad-card">
                          <button
                            type="button"
                            className="tf-quad-check"
                            onClick={() => toggleTask(t.id)}
                            aria-label="Complete task"
                          />
                          <span className="tf-quad-title">{t.task || t.title}</span>
                          <span className="tf-quad-prio high" />
                        </div>
                      ))}
                      {eisenhowerQuadrants.q1.length === 0 && (
                        <div className="tf-quad-empty">No urgent high-impact items.</div>
                      )}
                    </div>
                  </div>

                  <div className="tf-quadrant q2">
                    <div className="tf-quadrant-header">
                      <span className="tf-quad-tag q2">SCHEDULE</span>
                      <h4>High Impact, Future</h4>
                      <span className="tf-quad-count">{eisenhowerQuadrants.q2.length}</span>
                    </div>
                    <div className="tf-quad-items">
                      {eisenhowerQuadrants.q2.map((t) => (
                        <div key={t.id} className="tf-quad-card">
                          <button
                            type="button"
                            className="tf-quad-check"
                            onClick={() => toggleTask(t.id)}
                            aria-label="Complete task"
                          />
                          <span className="tf-quad-title">{t.task || t.title}</span>
                          <span className="tf-quad-prio high" />
                        </div>
                      ))}
                      {eisenhowerQuadrants.q2.length === 0 && (
                        <div className="tf-quad-empty">No scheduled high-impact items.</div>
                      )}
                    </div>
                  </div>

                  <div className="tf-quadrant q3">
                    <div className="tf-quadrant-header">
                      <span className="tf-quad-tag q3">DELEGATE / FAST</span>
                      <h4>Urgent Operational</h4>
                      <span className="tf-quad-count">{eisenhowerQuadrants.q3.length}</span>
                    </div>
                    <div className="tf-quad-items">
                      {eisenhowerQuadrants.q3.map((t) => (
                        <div key={t.id} className="tf-quad-card">
                          <button
                            type="button"
                            className="tf-quad-check"
                            onClick={() => toggleTask(t.id)}
                            aria-label="Complete task"
                          />
                          <span className="tf-quad-title">{t.task || t.title}</span>
                          <span className="tf-quad-prio medium" />
                        </div>
                      ))}
                      {eisenhowerQuadrants.q3.length === 0 && (
                        <div className="tf-quad-empty">No urgent operational items.</div>
                      )}
                    </div>
                  </div>

                  <div className="tf-quadrant q4">
                    <div className="tf-quadrant-header">
                      <span className="tf-quad-tag q4">BACKLOG</span>
                      <h4>Low Impact / Future</h4>
                      <span className="tf-quad-count">{eisenhowerQuadrants.q4.length}</span>
                    </div>
                    <div className="tf-quad-items">
                      {eisenhowerQuadrants.q4.map((t) => (
                        <div key={t.id} className="tf-quad-card">
                          <button
                            type="button"
                            className="tf-quad-check"
                            onClick={() => toggleTask(t.id)}
                            aria-label="Complete task"
                          />
                          <span className="tf-quad-title">{t.task || t.title}</span>
                          <span className="tf-quad-prio low" />
                        </div>
                      ))}
                      {eisenhowerQuadrants.q4.length === 0 && (
                        <div className="tf-quad-empty">No backlog items.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: FAVORITES VIEW */}
          {activeView === "favorites" && (
            <div className="tf-favorites-view">
              <div className="tf-view-header">
                <h2>Starred Priorities</h2>
                <span className="tf-view-subtitle">High-value bookmarks across your workspaces</span>
              </div>
              <TaskList
                tasks={tasks.filter((t) => Number(t.favorite) === 1)}
                getTasks={getTasks}
                deleteTask={deleteTask}
                toggleTask={toggleTask}
                toggleFavorite={toggleFavorite}
                updateTask={updateTask}
                search=""
                filter="all"
                priorityFilter="all"
                loading={loadingTasks}
                backendError={backendError}
                onRetry={getTasks}
                workspaces={userWorkspaces.filter((w) => w.id !== "all")}
              />
            </div>
          )}

          {/* VIEW 4: DAILY PLANNER VIEW */}
          {activeView === "planner" && (
            <div className="tf-planner-view">
              <DailyPlanner
                tasks={tasks}
                getTasks={getTasks}
                toggleTask={toggleTask}
                API_URL={API_URL}
                initialTab="roadmap"
                onNavigate={changeView}
                backendError={backendError}
                onRetry={getTasks}
                currentWorkspace={currentWorkspaceObj.name}
              />
            </div>
          )}

          {/* VIEW 5: SMART RESCHEDULING VIEW */}
          {activeView === "reschedule" && (
            <div className="tf-reschedule-view">
              <DailyPlanner
                tasks={tasks}
                getTasks={getTasks}
                toggleTask={toggleTask}
                API_URL={API_URL}
                initialTab="reschedule"
                onNavigate={changeView}
                backendError={backendError}
                onRetry={getTasks}
                currentWorkspace={currentWorkspaceObj.name}
              />
            </div>
          )}

          {/* VIEW 6: PRODUCTIVITY INSIGHTS */}
          {activeView === "intelligence" && (
            <div className="tf-intelligence-view">
              <ProductivityDashboard tasks={tasks} onNavigate={changeView} />
            </div>
          )}

          {/* VIEW 7: USER PROFILE & ACCOUNT SETTINGS */}
          {activeView === "profile" && (
            <div className="tf-profile-view">
              <UserProfileSettings
                user={currentUser}
                onUpdateUser={handleUserUpdated}
                tasks={tasks}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                onClearTasks={() => setShowDeleteAllModal(true)}
                onLogout={() => setShowLogoutModal(true)}
                onNavigate={changeView}
              />
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          4. GLOBAL AI COMMAND OMNIBAR MODAL (⌘K Console)
          ========================================================================= */}
      {showAiConsole && (
        <div
          className="tf-modal-backdrop"
          onClick={() => setShowAiConsole(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tf-omnibar-modal-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-omnibar-modal-header">
              <div className="tf-omnibar-input-row tf-gemini-omnibar-row">
                <div className="tf-omnibar-glow-icon" aria-hidden="true">
                  <TaskFlowSymbol size={20} fill={darkMode ? "#a78bfa" : "#7c3aed"} glow />
                </div>
                <input
                  ref={omnibarInputRef}
                  type="text"
                  className="tf-omnibar-modal-input"
                  placeholder="Ask TaskFlow: 'Finish API review Friday 4pm #High @work'..."
                  value={commandInput}
                  onChange={(e) => {
                    setCommandInput(e.target.value);
                    if (commandError) setCommandError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleCommandSubmit();
                    }
                  }}
                  disabled={commandLoading}
                />
                <button
                  type="button"
                  className="tf-omnibar-close-btn"
                  onClick={() => setShowAiConsole(false)}
                  aria-label="Close modal"
                >
                  <FiX />
                </button>
              </div>

              {/* Natural Language Token Badges */}
              <div className="tf-omnibar-hints-row">
                <span className="tf-omnibar-hint-tag">#Priority</span>
                <span className="tf-omnibar-hint-tag">@DueDate</span>
                <span className="tf-omnibar-hint-tag">Natural Language NLP</span>
                <span className="tf-omnibar-hint-kbd">Press ↵ to Execute</span>
              </div>
            </div>

            {commandError && (
              <div className="tf-omnibar-alert error">
                <FiAlertTriangle />
                <span>{commandError}</span>
              </div>
            )}

            {commandSuccess && (
              <div className="tf-omnibar-alert success">
                <FiCheckCircle />
                <span>{commandSuccess}</span>
              </div>
            )}

            <div className="tf-omnibar-prompt-list">
              <div className="tf-prompt-group-label">Quick Suggestions</div>
              {PROMPT_SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="tf-prompt-list-item"
                  onClick={() => handleCommandSubmit(item)}
                  disabled={commandLoading}
                >
                  <FiArrowRight className="tf-prompt-arrow" />
                  <span>{item}</span>
                  <span className="tf-prompt-action">Execute ↵</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. STANDARD ADD TASK MODAL (Hotkey: C)
          ========================================================================= */}
      {showAddTaskModal && (
        <div
          className="tf-modal-backdrop"
          onClick={() => setShowAddTaskModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tf-task-modal-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-modal-header">
              <div className="tf-modal-header-brand">
                <div className="tf-modal-brand-badge">
                  <TaskFlowSymbol size={16} fill="#ffffff" glow />
                </div>
                <div className="tf-modal-header-text">
                  <h3>Create New Task</h3>
                  <span className="tf-modal-workspace-pill">
                    <FiLayers size={11} />
                    <span>
                      {activeWorkspace !== "all"
                        ? userWorkspaces.find((w) => w.id === activeWorkspace)?.name || "Engineering Core"
                        : "Engineering Core"}
                    </span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="tf-modal-close"
                onClick={() => setShowAddTaskModal(false)}
                aria-label="Close modal"
                title="Close (Esc)"
              >
                <FiX size={16} />
              </button>
            </div>
            <AddTask
              getTasks={getTasks}
              onClose={() => setShowAddTaskModal(false)}
              currentWorkspace={activeWorkspace !== "all" ? (userWorkspaces.find((w) => w.id === activeWorkspace)?.name || "Engineering Core") : "Engineering Core"}
              workspaces={userWorkspaces.filter((w) => w.id !== "all")}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          6. EDIT TASK MODAL
          ========================================================================= */}
      {editingTask && (
        <div
          className="tf-modal-backdrop"
          onClick={closeEditModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tf-task-modal-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-modal-header">
              <h3>Edit Task</h3>
              <button
                type="button"
                className="tf-modal-close"
                onClick={closeEditModal}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>
            <div className="tf-edit-modal-form">
              <div className="tf-edit-field">
                <label htmlFor="edit-task-title">Task Title</label>
                <input
                  id="edit-task-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="tf-edit-input"
                  placeholder="Task description..."
                />
              </div>

              <div className="tf-edit-field">
                <label htmlFor="edit-task-priority">Priority</label>
                <select
                  id="edit-task-priority"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="tf-edit-select"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="tf-edit-field">
                <label htmlFor="edit-task-due">Due Date</label>
                <input
                  id="edit-task-due"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="tf-edit-date"
                />
              </div>

              <div className="tf-edit-field">
                <label htmlFor="edit-task-workspace">Workspace</label>
                <select
                  id="edit-task-workspace"
                  value={editWorkspace}
                  onChange={(e) => setEditWorkspace(e.target.value)}
                  className="tf-edit-select"
                >
                  {userWorkspaces
                    .filter((w) => w.id !== "all")
                    .map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="tf-modal-actions">
                <button
                  type="button"
                  className="tf-btn-modal-cancel"
                  onClick={closeEditModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="tf-btn-modal-save"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editTitle.trim()}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. DELETE TASK CONFIRMATION MODAL
          ========================================================================= */}
      {taskToDelete && (
        <div
          className="tf-modal-backdrop"
          onClick={closeDeleteModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tf-task-modal-surface confirm-delete"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-modal-header">
              <FiAlertTriangle className="tf-delete-alert-icon" />
              <h3>Confirm Deletion</h3>
            </div>
            <p className="tf-delete-prompt">
              Are you sure you want to permanently remove this task?
            </p>
            <div className="tf-delete-task-preview">
              "{taskToDelete.task || taskToDelete.title}"
            </div>
            <div className="tf-modal-actions">
              <button
                type="button"
                className="tf-btn-modal-cancel"
                onClick={closeDeleteModal}
              >
                Keep Task
              </button>
              <button
                type="button"
                className="tf-btn-modal-delete"
                onClick={handleConfirmDelete}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7B. DELETE ALL / CLEAR TASKS CONFIRMATION MODAL
          ========================================================================= */}
      {showDeleteAllModal && (
        <div
          className="tf-modal-backdrop"
          onClick={() => !deletingAll && setShowDeleteAllModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tf-task-modal-surface confirm-delete"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-modal-header">
              <FiAlertTriangle className="tf-delete-alert-icon" />
              <h3>Clear Workspace Tasks</h3>
              <button
                type="button"
                className="tf-modal-close"
                onClick={() => !deletingAll && setShowDeleteAllModal(false)}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>
            <p className="tf-delete-prompt">
              You are about to clear tasks from your TaskFlow workspace. Choose an option below:
            </p>

            <div className="tf-clear-stats-summary">
              <div className="tf-clear-stat-pill">
                <span className="tf-stat-number">{tasks.length}</span>
                <span className="tf-stat-label">Total Tasks</span>
              </div>
              <div className="tf-clear-stat-pill completed">
                <span className="tf-stat-number">
                  {tasks.filter((t) => Number(t.completed) === 1).length}
                </span>
                <span className="tf-stat-label">Completed</span>
              </div>
              <div className="tf-clear-stat-pill active">
                <span className="tf-stat-number">
                  {tasks.filter((t) => Number(t.completed) !== 1).length}
                </span>
                <span className="tf-stat-label">Active</span>
              </div>
            </div>

            <div className="tf-modal-actions bulk-delete-actions">
              <button
                type="button"
                className="tf-btn-modal-cancel"
                onClick={() => setShowDeleteAllModal(false)}
                disabled={deletingAll}
              >
                Cancel
              </button>

              {tasks.some((t) => Number(t.completed) === 1) && (
                <button
                  type="button"
                  className="tf-btn-modal-clear-completed"
                  onClick={() => handleDeleteAllTasks(true)}
                  disabled={deletingAll}
                >
                  {deletingAll ? "Clearing..." : "Clear Completed Only"}
                </button>
              )}

              <button
                type="button"
                className="tf-btn-modal-delete"
                onClick={() => handleDeleteAllTasks(false)}
                disabled={deletingAll}
              >
                {deletingAll ? "Deleting..." : "Delete All Tasks"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7C. DAY-WISE CLEAR CONFIRMATION MODAL
          ========================================================================= */}
      {dayGroupToClear && (
        <div
          className="tf-modal-backdrop"
          onClick={() => !clearingDayTasks && setDayGroupToClear(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tf-task-modal-surface confirm-delete"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-modal-header">
              <FiAlertTriangle className="tf-delete-alert-icon" />
              <h3>Clear Tasks for {dayGroupToClear.title}</h3>
              <button
                type="button"
                className="tf-modal-close"
                onClick={() => !clearingDayTasks && setDayGroupToClear(null)}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>
            <p className="tf-delete-prompt">
              You are about to clear tasks scheduled for <strong>{dayGroupToClear.title}</strong> ({dayGroupToClear.subtitle}). Choose an option below:
            </p>

            <div className="tf-clear-stats-summary">
              <div className="tf-clear-stat-pill">
                <span className="tf-stat-number">{dayGroupToClear.tasks.length}</span>
                <span className="tf-stat-label">Day Total</span>
              </div>
              <div className="tf-clear-stat-pill completed">
                <span className="tf-stat-number">
                  {dayGroupToClear.tasks.filter((t) => Number(t.completed) === 1).length}
                </span>
                <span className="tf-stat-label">Completed</span>
              </div>
              <div className="tf-clear-stat-pill active">
                <span className="tf-stat-number">
                  {dayGroupToClear.tasks.filter((t) => Number(t.completed) !== 1).length}
                </span>
                <span className="tf-stat-label">Active</span>
              </div>
            </div>

            <div className="tf-modal-actions bulk-delete-actions">
              <button
                type="button"
                className="tf-btn-modal-cancel"
                onClick={() => setDayGroupToClear(null)}
                disabled={clearingDayTasks}
              >
                Cancel
              </button>

              {dayGroupToClear.tasks.some((t) => Number(t.completed) === 1) && (
                <button
                  type="button"
                  className="tf-btn-modal-clear-completed"
                  onClick={() => handleConfirmClearDayTasks(true)}
                  disabled={clearingDayTasks}
                >
                  {clearingDayTasks ? "Clearing..." : "Clear Completed in Day"}
                </button>
              )}

              <button
                type="button"
                className="tf-btn-modal-delete"
                onClick={() => handleConfirmClearDayTasks(false)}
                disabled={clearingDayTasks}
              >
                {clearingDayTasks ? "Deleting..." : `Delete All ${dayGroupToClear.title} Tasks`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. LOGOUT CONFIRMATION MODAL
          ========================================================================= */}
      {showLogoutModal && (
        <div
          className="tf-modal-backdrop"
          onClick={() => setShowLogoutModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tf-task-modal-surface confirm-logout"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-modal-header">
              <h3>Sign Out</h3>
              <button
                type="button"
                className="tf-modal-close"
                onClick={() => setShowLogoutModal(false)}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>
            <p className="tf-delete-prompt">
              Are you sure you want to sign out of your TaskFlow workspace?
            </p>
            <div className="tf-modal-actions">
              <button
                type="button"
                className="tf-btn-modal-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Stay Signed In
              </button>
              <button
                type="button"
                className="tf-btn-modal-logout"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Taskflow agent Trigger Pill */}
      <button
        type="button"
        className="tf-chat-floating-trigger"
        onClick={() => setShowAiChat(true)}
        title="Open Taskflow agent — ⌘J"
      >
        <TaskFlowSymbol size={18} fill="#ffffff" glow />
        <span className="tf-floating-text">Taskflow agent</span>
        <span className="tf-floating-badge">Live</span>
      </button>

      {/* Interactive Taskflow agent Strategy Drawer */}
      <AiChatAssistant
        isOpen={showAiChat}
        onClose={() => setShowAiChat(false)}
        tasks={tasks}
        onAddTask={handleAddDirectTask}
        activeWorkspace={currentWorkspaceObj?.name}
        injectedInteraction={aiChatInjectedMessage}
      />

      {/* =========================================================================
          8B. GEMINI AI PLAN & STRATEGY MODAL
          ========================================================================= */}
      {showGeminiPlanModal && geminiPlanResult && (
        <div
          className="tf-modal-backdrop tf-gemini-plan-modal-backdrop"
          onClick={() => !importingPlanTasks && setShowGeminiPlanModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tf-gemini-plan-modal-surface"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="tf-gemini-modal-header">
              <div className="tf-gemini-modal-brand">
                <div className="tf-gemini-modal-sparkle-pill">
                  <TaskFlowSymbol size={24} fill="#ffffff" glow />
                </div>
                <div className="tf-gemini-modal-title-wrap">
                  <div className="tf-gemini-eyebrow-pill">
                    <span className="tf-sparkle-mini">✦</span>
                    <span>Gemini AI Strategy & Schedule Plan</span>
                  </div>
                  <h2 className="tf-gemini-plan-headline">
                    {(geminiPlanResult.totalDays || geminiPlanResult.days) === 1 ? "Schedule" : "Mastery Plan"}: {geminiPlanResult.subject}
                  </h2>
                  <p className="tf-gemini-plan-target-goal">
                    Goal: &ldquo;{geminiPlanResult.goal}&rdquo;
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="tf-modal-close"
                onClick={() => !importingPlanTasks && setShowGeminiPlanModal(false)}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>

            {/* Quick Metrics Strip */}
            <div className="tf-gemini-plan-metrics-strip">
              <div className="tf-gemini-metric-pill">
                <span className="tf-pill-icon">📅</span>
                <span className="tf-pill-text">
                  {geminiPlanResult.totalDays} {(geminiPlanResult.totalDays || geminiPlanResult.days) === 1 ? "Day Schedule" : "Days Schedule"}
                </span>
              </div>
              <div className="tf-gemini-metric-pill">
                <span className="tf-pill-icon">⏱️</span>
                <span className="tf-pill-text">
                  {geminiPlanResult.dailyHours} hrs / day ({geminiPlanResult.totalHours} hrs total)
                </span>
              </div>
              <div className="tf-gemini-metric-pill">
                <span className="tf-pill-icon">⚡</span>
                <span className="tf-pill-text">
                  {geminiPlanResult.actionableTasks?.length || 0} Milestone Tasks
                </span>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="tf-gemini-plan-body">
              {/* Strategic Answer & Overview */}
              {geminiPlanResult.overview && (
                <div className="tf-gemini-overview-card">
                  <div className="tf-gemini-overview-title">
                    <span className="tf-gemini-sparkle-glyph">✦</span>
                    <span>Strategic Approach & Best Strategy</span>
                  </div>
                  <p className="tf-gemini-overview-desc">{geminiPlanResult.overview}</p>
                </div>
              )}

              {/* Actionable Recommendations */}
              {Array.isArray(geminiPlanResult.recommendations) &&
                geminiPlanResult.recommendations.length > 0 && (
                  <div className="tf-gemini-recommendations-section">
                    <div className="tf-gemini-section-heading">
                      <span className="tf-gemini-sparkle-glyph">✦</span>
                      <span>High-Yield Recommendations</span>
                    </div>
                    <div className="tf-gemini-recs-grid">
                      {geminiPlanResult.recommendations.map((rec, idx) => (
                        <div key={idx} className="tf-gemini-rec-card">
                          <span className="tf-gemini-rec-bullet">💡</span>
                          <span className="tf-gemini-rec-text">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Day-by-day Milestone Tasks */}
              <div className="tf-gemini-tasks-section">
                <div className="tf-gemini-tasks-header">
                  <div className="tf-gemini-section-heading">
                    <span className="tf-gemini-sparkle-glyph">✦</span>
                    <span>
                      Milestone Action Tasks ({selectedPlanTaskIndices.size} of{" "}
                      {geminiPlanResult.actionableTasks?.length || 0} selected)
                    </span>
                  </div>

                  <button
                    type="button"
                    className="tf-gemini-toggle-all-btn"
                    onClick={() => {
                      if (
                        selectedPlanTaskIndices.size ===
                        (geminiPlanResult.actionableTasks?.length || 0)
                      ) {
                        setSelectedPlanTaskIndices(new Set());
                      } else {
                        setSelectedPlanTaskIndices(
                          new Set((geminiPlanResult.actionableTasks || []).map((_, i) => i))
                        );
                      }
                    }}
                  >
                    {selectedPlanTaskIndices.size ===
                    (geminiPlanResult.actionableTasks?.length || 0)
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>

                <div className="tf-gemini-schedule-days">
                  {geminiPlanResult.schedule?.map((day) => (
                    <div key={day.dayNumber} className="tf-gemini-day-group">
                      <div className="tf-gemini-day-bar">
                        <span className="tf-gemini-day-badge">{day.dayLabel}</span>
                        <span className="tf-gemini-day-theme">{day.theme}</span>
                        <span className="tf-gemini-day-date">{day.date}</span>
                      </div>

                      <div className="tf-gemini-day-tasks-list">
                        {day.items?.map((item) => {
                          const originalIdx = (
                            geminiPlanResult.actionableTasks || []
                          ).findIndex((t) => t.task === item.task);
                          const isSelected =
                            originalIdx !== -1 && selectedPlanTaskIndices.has(originalIdx);

                          return (
                            <div
                              key={item.id}
                              className={`tf-gemini-task-item ${isSelected ? "selected" : ""}`}
                              onClick={() => {
                                if (originalIdx === -1) return;
                                setSelectedPlanTaskIndices((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(originalIdx)) {
                                    next.delete(originalIdx);
                                  } else {
                                    next.add(originalIdx);
                                  }
                                  return next;
                                });
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by item onClick
                                className="tf-gemini-task-checkbox"
                              />

                              <div className="tf-gemini-task-content">
                                <span className="tf-gemini-task-title">{item.task}</span>
                                <div className="tf-gemini-task-tags">
                                  <span
                                    className={`tf-tag-priority pri-${(item.priority || "Medium").toLowerCase()}`}
                                  >
                                    {item.priority}
                                  </span>
                                  {item.duration && (
                                    <span className="tf-tag-duration">
                                      <FiClock /> {item.duration}
                                    </span>
                                  )}
                                  {item.phase && (
                                    <span className="tf-tag-phase">
                                      <FiLayers /> {item.phase}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="tf-gemini-modal-footer">
              <button
                type="button"
                className="tf-btn-modal-cancel"
                onClick={() => !importingPlanTasks && setShowGeminiPlanModal(false)}
                disabled={importingPlanTasks}
              >
                Cancel
              </button>

              <button
                type="button"
                className="tf-gemini-btn-single-task"
                onClick={handleAddPlanAsSingleTask}
                disabled={importingPlanTasks}
                title="Add only this statement as a single task instead of importing all breakdown tasks"
              >
                <FiPlus />
                <span>Add as Single Task Instead</span>
              </button>

              <button
                type="button"
                className="tf-gemini-btn-open-planner"
                onClick={() => {
                  setShowGeminiPlanModal(false);
                  changeView("planner");
                }}
                disabled={importingPlanTasks}
                title="Open full interactive planner"
              >
                <FiCalendar />
                <span>Open in Daily Planner</span>
              </button>

              <button
                type="button"
                className="tf-gemini-btn-import-all"
                onClick={handleImportGeminiPlanTasks}
                disabled={importingPlanTasks || selectedPlanTaskIndices.size === 0}
              >
                {importingPlanTasks ? (
                  <>
                    <FiRefreshCw className="spin" />
                    <span>Importing Tasks...</span>
                  </>
                ) : (
                  <>
                    <TaskFlowSymbol size={16} fill="#ffffff" />
                    <span>
                      Add Selected ({selectedPlanTaskIndices.size}) to Workspace
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. CREATE NEW WORKSPACE MODAL
          ========================================================================= */}
      {showAddWorkspaceModal && (
        <div
          className="tf-modal-backdrop"
          onClick={() => setShowAddWorkspaceModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tf-task-modal-surface tf-add-workspace-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-modal-header">
              <div className="tf-modal-icon-wrap violet">
                <FiLayers />
              </div>
              <h3>Create New Workspace</h3>
              <button
                type="button"
                className="tf-modal-close"
                onClick={() => setShowAddWorkspaceModal(false)}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace}>
              <div className="tf-modal-body">
                <p className="tf-modal-description">
                  Organize tasks and roadmaps in a dedicated workspace for distinct teams or goals.
                </p>

                <div className="tf-edit-field">
                  <label htmlFor="ws-name-input">Workspace Name</label>
                  <input
                    id="ws-name-input"
                    type="text"
                    className="tf-edit-input"
                    placeholder="e.g. Marketing, DevOps, Mobile App..."
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    autoFocus
                    maxLength={35}
                  />
                </div>

                <div className="tf-edit-field">
                  <label>Accent Dot Color</label>
                  <div className="tf-workspace-color-picker">
                    {[
                      { name: "Violet", color: "#8b5cf6" },
                      { name: "Cyan", color: "#06b6d4" },
                      { name: "Emerald", color: "#10b981" },
                      { name: "Amber", color: "#f59e0b" },
                      { name: "Rose", color: "#f43f5e" },
                      { name: "Indigo", color: "#6366f1" },
                      { name: "Sky", color: "#0284c7" },
                    ].map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        className={`tf-color-dot-btn ${newWorkspaceColor === c.color ? "selected" : ""}`}
                        style={{ backgroundColor: c.color }}
                        onClick={() => setNewWorkspaceColor(c.color)}
                        title={c.name}
                        aria-label={`Select color ${c.name}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="tf-modal-actions">
                <button
                  type="button"
                  className="tf-btn-modal-cancel"
                  onClick={() => setShowAddWorkspaceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-btn-modal-save"
                  disabled={!newWorkspaceName.trim()}
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
