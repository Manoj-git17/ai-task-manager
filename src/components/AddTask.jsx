import { useState } from "react";
import TaskFlowSymbol from "./TaskFlowSymbol";
import {
  FiZap,
  FiPlus,
  FiCalendar,
  FiFlag,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowRight,
  FiCornerDownLeft,
  FiLayers,
} from "react-icons/fi";

function AddTask({
  getTasks,
  onTaskAdded,
  onClose,
  currentWorkspace = "Engineering Core",
  workspaces = [],
}) {
  const [task, setTask] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState(
    currentWorkspace || "Engineering Core"
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // AI Natural Language Input State
  const [aiInput, setAiInput] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState("");

  const API_URL = (
    import.meta.env.VITE_API_URL || "/api"
  ).replace(/\/+$/, "");

  const PROMPT_SUGGESTIONS = [
    "Prepare project presentation tomorrow #High",
    "Refactor database queries in 2 days #High",
    "Weekly sprint review by Friday #Medium",
  ];

  function showMessage(text) {
    setMessage(text);
    setError("");
  }

  function showError(text) {
    setError(text);
    setMessage("");
  }

  async function handleAiParse(customText) {
    const textToParse =
      typeof customText === "string" ? customText.trim() : aiInput.trim();
    if (!textToParse) return;

    setAiParsing(true);
    setAiFeedback("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/ai/parse`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: textToParse,
          referenceDate: new Date().toISOString(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        if (data.task) setTask(data.task);
        if (data.priority) setPriority(data.priority);
        if (data.dueDate) setDueDate(data.dueDate);
        setAiFeedback(
          data.summary || `Parsed: ${data.task} · Priority: ${data.priority}`
        );
        if (!customText) {
          setAiInput("");
        }
      } else {
        showError(data.message || "Failed to parse natural language task.");
      }
    } catch (err) {
      console.error("AI parse error:", err);
      showError("Could not connect to AI parse service.");
    } finally {
      setAiParsing(false);
    }
  }

  async function handleAiQuickAdd() {
    const trimmedAi = aiInput.trim();
    if (!trimmedAi) {
      showError("Please enter a natural language task description.");
      return;
    }

    setAiParsing(true);
    setAiFeedback("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // 1. Parse natural language
      const parseResponse = await fetch(`${API_URL}/ai/parse`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: trimmedAi,
          referenceDate: new Date().toISOString(),
        }),
      });

      const parseData = await parseResponse.json().catch(() => ({}));

      if (!parseResponse.ok || !parseData.success) {
        showError(parseData.message || "Unable to parse AI task.");
        return;
      }

      const finalTask = parseData.task || trimmedAi;
      const finalPriority = parseData.priority || "Medium";
      const finalDueDate = parseData.dueDate || null;

      // 2. Create the parsed task in database
      const createResponse = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: {
          ...headers,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task: finalTask,
          priority: finalPriority,
          dueDate: finalDueDate,
          workspace: selectedWorkspace || "Engineering Core",
        }),
      });

      const createData = await createResponse.json().catch(() => ({}));

      if (!createResponse.ok) {
        throw new Error(createData.message || "Failed to create parsed task.");
      }

      showMessage(`Task created: "${finalTask}"`);
      setAiInput("");
      setAiFeedback("");
      setTask("");
      setDueDate("");
      setPriority("Medium");

      if (typeof onTaskAdded === "function" && createData.task) {
        onTaskAdded(createData.task);
      } else if (typeof getTasks === "function") {
        await getTasks();
      }

      if (typeof onClose === "function") {
        onClose();
      }
    } catch (err) {
      console.error("AI Quick-Add error:", err);
      showError(err.message || "Failed to quick-add task.");
    } finally {
      setAiParsing(false);
    }
  }

  async function addTask() {
    const trimmedTask = task.trim();

    if (!trimmedTask) {
      showError("Please enter a task title.");
      return;
    }

    if (trimmedTask.length > 500) {
      showError("Task description must not exceed 500 characters.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const token = localStorage.getItem("token");

      if (!token) {
        showError("You must be logged in to create a task.");
        return;
      }

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
          workspace: selectedWorkspace || "Engineering Core",
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

      if (typeof onTaskAdded === "function" && data.task) {
        onTaskAdded(data.task);
      } else if (typeof getTasks === "function") {
        await getTasks();
      }

      if (typeof onClose === "function") {
        onClose();
      }
    } catch (err) {
      console.error("Add task failed:", err);

      if (err instanceof TypeError) {
        showError(
          `Cannot connect to backend at ${API_URL}. Check that your server is running.`
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
      {/* AI Natural Language Command Bar */}
      <div className="ai-quick-add-banner">
        <div className="ai-quick-add-header">
          <div className="ai-badge">
            <TaskFlowSymbol size={15} glow className="ai-badge-icon" aria-hidden="true" fill="#ffffff" />
            <span>TaskFlow Quick-Add</span>
          </div>
          <span className="ai-quick-add-tip">
            Natural language parsing for titles, priorities & deadlines
          </span>
        </div>

        <div className="ai-parse-bar">
          <div className="ai-parse-input-wrapper">
            <TaskFlowSymbol size={15} className="ai-input-spark" aria-hidden="true" />
            <input
              id="ai-quick-add-input"
              className="ai-parse-input"
              type="text"
              autoComplete="off"
              placeholder="e.g. Prepare project presentation tomorrow #High"
              value={aiInput}
              disabled={aiParsing || submitting}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAiQuickAdd();
                }
              }}
              aria-label="Natural language task command input"
            />
          </div>

          <div className="ai-actions-group">
            <button
              type="button"
              className="btn btn-ai-parse"
              disabled={aiParsing || submitting || !aiInput.trim()}
              onClick={() => handleAiParse()}
              title="Parse title, priority, and due date into form below"
            >
              <FiArrowRight aria-hidden="true" />
              <span>{aiParsing ? "Parsing..." : "Parse into Form"}</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm btn-ai-quick-create"
              disabled={aiParsing || submitting || !aiInput.trim()}
              onClick={handleAiQuickAdd}
              title="Parse and immediately create task in workspace"
            >
              <FiPlus aria-hidden="true" />
              <span>Quick Create</span>
              <span className="btn-key-hint" aria-hidden="true">
                <FiCornerDownLeft />
              </span>
            </button>
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="ai-prompt-chips">
          <span className="chips-label">Try:</span>
          <div className="chips-list">
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="prompt-chip"
                onClick={() => setAiInput(suggestion)}
                title="Use this example prompt"
              >
                <span className="chip-sparkle">✦</span>
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {aiFeedback && (
        <div className="ai-feedback-pill">
          <FiCheckCircle className="feedback-icon" aria-hidden="true" />
          <span>{aiFeedback}</span>
        </div>
      )}

      {message && (
        <p className="form-success" role="status">
          <FiCheckCircle aria-hidden="true" />
          <span>{message}</span>
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          <FiAlertCircle aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {/* Manual Task Configuration Form */}
      <div className="add-task-fields-grid">
        <div className="form-field title-field">
          <div className="task-title-header">
            <label htmlFor="task-title">Task Title</label>
            {task.trim().length > 3 && (
              <button
                type="button"
                className="btn-text-ai-parse"
                onClick={() => handleAiParse(task)}
                title="Extract priority and date from title"
              >
                <FiZap aria-hidden="true" />
                <span>Extract with AI</span>
              </button>
            )}
          </div>

          <input
            id="task-title"
            className="task-input task-input-hero"
            type="text"
            autoComplete="off"
            placeholder="What needs to be done?"
            value={task}
            maxLength={200}
            disabled={submitting}
            onChange={(event) => {
              setTask(event.target.value);
              setError("");
              setMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                addTask();
              }
            }}
          />
        </div>

        <div className="form-fields-triplet-row">
          <div className="form-field priority-field">
            <label htmlFor="task-priority">
              <FiFlag aria-hidden="true" />
              <span>Priority</span>
            </label>

            <select
              id="task-priority"
              className="priority-select"
              value={priority}
              disabled={submitting}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="High">🔴 High Priority</option>
              <option value="Medium">🟡 Medium Priority</option>
              <option value="Low">🟢 Low Priority</option>
            </select>
          </div>

          <div className="form-field date-field">
            <label htmlFor="task-due-date">
              <FiCalendar aria-hidden="true" />
              <span>Due Date</span>
            </label>

            <input
              id="task-due-date"
              className="date-input"
              type="date"
              value={dueDate}
              disabled={submitting}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>

          <div className="form-field workspace-field">
            <label htmlFor="task-workspace">
              <FiLayers aria-hidden="true" />
              <span>Workspace</span>
            </label>

            <select
              id="task-workspace"
              className="workspace-select"
              value={selectedWorkspace}
              disabled={submitting}
              onChange={(event) => setSelectedWorkspace(event.target.value)}
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

        <div className="add-task-actions-footer">
          <div className="footer-kbd-hint">
            <span>Press <kbd>↵ Enter</kbd> to save</span>
          </div>

          <div className="footer-buttons-group">
            {typeof onClose === "function" && (
              <button
                type="button"
                className="btn btn-secondary btn-cancel-task"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-add-submit"
              onClick={addTask}
              disabled={submitting || !task.trim()}
            >
              <FiPlus aria-hidden="true" />
              <span>{submitting ? "Adding..." : "Add Task"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddTask;
