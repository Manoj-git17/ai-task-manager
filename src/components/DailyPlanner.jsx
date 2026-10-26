import { useState, useMemo, useEffect } from "react";
import { toast } from "react-toastify";
import {
  FiCalendar,
  FiClock,
  FiZap,
  FiPlus,
  FiCheck,
  FiRotateCcw,
  FiRefreshCw,
  FiAlertTriangle,
  FiCheckCircle,
  FiAlertCircle,
  FiTarget,
  FiInfo,
  FiX,
} from "react-icons/fi";

function DailyPlanner({
  tasks = [],
  getTasks,
  onTasksAdded,
  initialTab = "roadmap",
  onNavigate,
  backendError = null,
  onRetry = null,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Goal Roadmap State
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedItems, setSelectedItems] = useState({});
  const [addedItemIds, setAddedItemIds] = useState(new Set());

  // Smart Rescheduling State
  const [rescheduleCapacity, setRescheduleCapacity] = useState(3);
  const [rescheduleHorizon, setRescheduleHorizon] = useState(7);
  const [hardDeadline, setHardDeadline] = useState("");
  const [includeAllIncomplete, setIncludeAllIncomplete] = useState(false);
  const [reschedulePlan, setReschedulePlan] = useState(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [applyingReschedule, setApplyingReschedule] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleSuccess, setRescheduleSuccess] = useState("");
  const [selectedRescheduleIds, setSelectedRescheduleIds] = useState({});

  const API_URL = (
    import.meta.env.VITE_API_URL || "/api"
  ).replace(/\/+$/, "");

  // Detect overdue tasks in current workspace
  const overdueTasksCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter((t) => {
      if (Number(t.completed) === 1 || t.completed === true || !t.dueDate) {
        return false;
      }
      const d = new Date(t.dueDate);
      if (Number.isNaN(d.getTime())) return false;
      d.setHours(0, 0, 0, 0);
      return d < today;
    }).length;
  }, [tasks]);

  const PRESETS = [
    {
      label: "DBMS Exam (5 days, 3h/day)",
      text: "I have a DBMS exam in 5 days and can study 3 hours daily.",
    },
    {
      label: "React Mastery (7 days, 2h/day)",
      text: "Learn React and build an app in 7 days with 2 hours per day.",
    },
    {
      label: "DSA Interview (6 days, 4h/day)",
      text: "Prepare for DSA technical interview in 6 days studying 4 hours daily.",
    },
  ];

  /* -------------------- GOAL ROADMAP HANDLERS -------------------- */

  async function handleGeneratePlan(customGoal) {
    const textToGenerate = typeof customGoal === "string" ? customGoal : goal;
    const trimmed = (textToGenerate || "").trim();

    if (!trimmed) {
      setError("Please enter a study or project goal with your timeline and hours.");
      return;
    }

    if (trimmed.length < 6) {
      setError("Goal description is too short. Please provide more detail (e.g., target subject, days, hours).");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to use the AI Daily Planner.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_URL}/ai/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          goal: trimmed,
          existingTasks: tasks,
          referenceDate: new Date().toISOString(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.plan) {
        throw new Error(data.message || "Failed to generate AI daily plan.");
      }

      setPlan(data.plan);

      // Select all non-existing tasks by default
      const initialSelection = {};
      data.plan.schedule.forEach((day) => {
        day.items.forEach((item) => {
          if (!item.isExisting) {
            initialSelection[item.id] = true;
          }
        });
      });
      setSelectedItems(initialSelection);
      setAddedItemIds(new Set());
    } catch (err) {
      console.error("AI Daily Planner generation error:", err);
      setError(err.message || "Could not connect to AI planner service.");
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(id) {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function handleSelectAll(select) {
    if (!plan) return;
    const updated = {};
    plan.schedule.forEach((day) => {
      day.items.forEach((item) => {
        if (!item.isExisting) {
          updated[item.id] = select;
        }
      });
    });
    setSelectedItems(updated);
  }

  async function handleAddSelectedToWorkspace() {
    if (!plan) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Your session has expired. Please log in again to add tasks.");
      return;
    }

    const toAdd = [];
    plan.schedule.forEach((day) => {
      day.items.forEach((item) => {
        if (selectedItems[item.id] && !item.isExisting && !addedItemIds.has(item.id)) {
          toAdd.push(item);
        }
      });
    });

    if (toAdd.length === 0) {
      setError("Please select at least one task to add to your workspace.");
      return;
    }

    setAdding(true);
    setError("");
    setSuccessMessage("");

    try {
      let createdCount = 0;
      const newlyAddedIds = new Set(addedItemIds);

      for (const item of toAdd) {
        const response = await fetch(`${API_URL}/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            task: item.task,
            priority: item.priority || "Medium",
            dueDate: item.dueDate || null,
          }),
        });

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setError("Your session has expired. Please log in again.");
          return;
        }

        if (response.ok) {
          createdCount++;
          newlyAddedIds.add(item.id);
        }
      }

      setAddedItemIds(newlyAddedIds);
      setSuccessMessage(`Successfully added ${createdCount} daily study tasks to your workspace.`);
      toast.success(`Added ${createdCount} planner tasks to your workspace.`);

      if (typeof onTasksAdded === "function") {
        onTasksAdded();
      } else if (typeof getTasks === "function") {
        await getTasks();
      }
    } catch (err) {
      console.error("Failed to add planner tasks to workspace:", err);
      setError(err.message || "Failed to add selected tasks.");
    } finally {
      setAdding(false);
    }
  }

  function handleResetPlan() {
    setPlan(null);
    setGoal("");
    setError("");
    setSuccessMessage("");
    setSelectedItems({});
    setAddedItemIds(new Set());
  }

  /* -------------------- SMART RESCHEDULING HANDLERS -------------------- */

  async function handleReviewSchedule() {
    const token = localStorage.getItem("token");
    if (!token) {
      setRescheduleError("Your session has expired. Please log in again.");
      return;
    }

    setRescheduleLoading(true);
    setRescheduleError("");
    setRescheduleSuccess("");

    try {
      const response = await fetch(`${API_URL}/ai/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dailyCapacityHours: Number(rescheduleCapacity) || 3,
          maxDaysAhead: Number(rescheduleHorizon) || 7,
          referenceDate: new Date().toISOString(),
          fixedDeadline: hardDeadline || null,
          includeAllIncomplete,
          tasks,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setRescheduleError("Your session has expired. Please log in again.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to compute reschedule recommendations.");
      }

      setReschedulePlan(data);

      // Select all achievable recommendations by default
      const initialSelection = {};
      (data.recommendations || []).forEach((r) => {
        if (r.status === "rescheduled" && r.proposedDueDate) {
          initialSelection[r.taskId] = true;
        }
      });
      setSelectedRescheduleIds(initialSelection);
    } catch (err) {
      console.error("AI Reschedule review error:", err);
      setRescheduleError(err.message || "Could not connect to rescheduling service.");
    } finally {
      setRescheduleLoading(false);
    }
  }

  function toggleRescheduleSelection(taskId) {
    setSelectedRescheduleIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  }

  function handleSelectAllReschedules(select) {
    if (!reschedulePlan) return;
    const updated = {};
    (reschedulePlan.recommendations || []).forEach((r) => {
      if (r.status === "rescheduled") {
        updated[r.taskId] = select;
      }
    });
    setSelectedRescheduleIds(updated);
  }

  async function handleApplyReschedule() {
    if (!reschedulePlan) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setRescheduleError("Your session has expired. Please log in again.");
      return;
    }

    const updatesToApply = (reschedulePlan.recommendations || [])
      .filter((r) => selectedRescheduleIds[r.taskId] && r.proposedDueDate)
      .map((r) => ({
        id: r.taskId,
        dueDate: r.proposedDueDate,
      }));

    if (updatesToApply.length === 0) {
      setRescheduleError("Please select at least one rescheduled task to apply.");
      return;
    }

    setApplyingReschedule(true);
    setRescheduleError("");
    setRescheduleSuccess("");

    try {
      const response = await fetch(`${API_URL}/ai/reschedule/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          updates: updatesToApply,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setRescheduleError("Your session has expired. Please log in again.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to apply rescheduling updates.");
      }

      const appliedCount = data.appliedCount || updatesToApply.length;
      setRescheduleSuccess(`Successfully rescheduled ${appliedCount} task${appliedCount === 1 ? "" : "s"} across your future schedule.`);
      toast.success(`Rescheduled ${appliedCount} tasks.`);

      // Refresh task list
      if (typeof onTasksAdded === "function") {
        onTasksAdded();
      } else if (typeof getTasks === "function") {
        await getTasks();
      }

      // Reset recommendation view
      setReschedulePlan(null);
      setSelectedRescheduleIds({});
    } catch (err) {
      console.error("Apply reschedule error:", err);
      setRescheduleError(err.message || "Unable to save schedule updates.");
    } finally {
      setApplyingReschedule(false);
    }
  }

  function handleCancelReschedule() {
    // Pure cancellation: closes preview without any modification to tasks
    setReschedulePlan(null);
    setSelectedRescheduleIds({});
    setRescheduleError("");
    setRescheduleSuccess("");
  }

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;
  const selectedRescheduleCount = Object.values(selectedRescheduleIds).filter(Boolean).length;

  return (
    <section className="workspace-panel workspace-planner-panel" aria-labelledby="ai-planner-heading">
      {/* Panel Top Heading & Sub-Tab Switcher */}
      <div className="workspace-panel-heading">
        <div className="planner-title-block">
          <div className="planner-heading-row">
            <span className="planner-badge">
              <FiCalendar aria-hidden="true" /> AI Daily Planner & Adaptive Rescheduling
            </span>
            <span className="planner-pill">Local Intelligence</span>
          </div>
          <h3 id="ai-planner-heading">Adaptive Milestone Roadmap & Schedule Recovery</h3>
          <p>
            Deconstruct new goals into structured study sessions, or intelligently balance overdue workloads around your daily availability.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="planner-tab-controls" role="tablist" aria-label="Planner Views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "roadmap"}
            className={`planner-tab-btn ${activeTab === "roadmap" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("roadmap");
              if (typeof onNavigate === "function") onNavigate("planner");
            }}
          >
            <FiTarget aria-hidden="true" /><span>Goal Roadmap</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reschedule"}
            className={`planner-tab-btn ${activeTab === "reschedule" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("reschedule");
              if (typeof onNavigate === "function") onNavigate("reschedule");
            }}
          >
            <FiRefreshCw aria-hidden="true" /><span>Smart Rescheduling</span>
            {overdueTasksCount > 0 && (
              <span className="planner-tab-badge" title={`${overdueTasksCount} overdue tasks in workspace`}>
                {overdueTasksCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {backendError && tasks.length === 0 && (
        <div className="tf-planner-error-banner" role="alert">
          <div className="tf-banner-content">
            <FiAlertTriangle className="tf-banner-icon" />
            <span><strong>Connection Offline:</strong> {backendError}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              className="tf-banner-retry-btn"
              onClick={onRetry}
            >
              <FiRefreshCw />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* ==================== TAB 1: GOAL ROADMAP ==================== */}
      {activeTab === "roadmap" && (
        <div className="planner-tab-content">
          {/* Preset Goal Chips */}
          <div className="planner-preset-container">
            <span className="planner-preset-label">Quick Ideas:</span>
            <div className="planner-preset-chips">
              {PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="planner-chip"
                  disabled={loading || adding}
                  onClick={() => {
                    setGoal(preset.text);
                    handleGeneratePlan(preset.text);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Goal Input Bar */}
          <div className="planner-input-wrapper">
            <div className="planner-input-field">
              <textarea
                id="planner-goal-input"
                className="planner-textarea"
                rows={2}
                autoComplete="off"
                placeholder="e.g. I have a DBMS exam in 5 days and can study 3 hours daily."
                value={goal}
                disabled={loading || adding}
                onChange={(e) => {
                  setGoal(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleGeneratePlan();
                  }
                }}
              />
            </div>

            <div className="planner-action-bar">
              <button
                type="button"
                className="btn btn-primary btn-generate-plan"
                disabled={loading || adding || !goal.trim()}
                onClick={() => handleGeneratePlan()}
              >
                {loading ? "Generating Plan..." : <><FiZap aria-hidden="true" /><span>Generate Daily Schedule</span></>}
              </button>

              {plan && (
                <button
                  type="button"
                  className="btn btn-secondary btn-reset-plan"
                  disabled={loading || adding}
                  onClick={handleResetPlan}
                  title="Clear plan and start over"
                >
                  <FiRotateCcw aria-hidden="true" /><span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="form-error planner-alert" role="alert">
              <><FiAlertCircle aria-hidden="true" /><span>{error}</span></>
            </div>
          )}

          {successMessage && (
            <div className="form-success planner-alert" role="status">
              <><FiCheckCircle aria-hidden="true" /><span>{successMessage}</span></>
            </div>
          )}

          {/* Loading Spinner */}
          {loading && (
            <div className="planner-loading-state">
              <div className="ai-spinner" aria-hidden="true" />
              <p>Structuring progressive milestones, sessions, and daily time blocks...</p>
            </div>
          )}

          {/* Generated Plan Review Section */}
          {plan && !loading && (
            <div className="planner-results">
              {/* Plan Metrics Bar */}
              <div className="planner-metrics-grid">
                <div className="planner-metric-card">
                  <span className="metric-label">Target Focus</span>
                  <strong className="metric-value">{plan.subject}</strong>
                </div>

                <div className="planner-metric-card">
                  <span className="metric-label">Duration</span>
                  <strong className="metric-value">{plan.totalDays} Days</strong>
                </div>

                <div className="planner-metric-card">
                  <span className="metric-label">Daily Commitment</span>
                  <strong className="metric-value">{plan.dailyHours} hrs / day</strong>
                </div>

                <div className="planner-metric-card">
                  <span className="metric-label">Total Deep Work</span>
                  <strong className="metric-value">{plan.totalHours} Hours</strong>
                </div>
              </div>

              {/* AI Productivity Recommendations */}
              {plan.recommendations && plan.recommendations.length > 0 && (
                <div className="planner-recommendations-card">
                  <div className="recommendations-header">
                    <FiZap className="recommendation-icon" aria-hidden="true" />
                    <h4>Tactical Execution Guidelines</h4>
                  </div>
                  <ul className="recommendations-list">
                    {plan.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Schedule Controls Header */}
              <div className="planner-schedule-header">
                <div className="schedule-header-left">
                  <h4>Proposed Day-by-Day Roadmap</h4>
                  <span className="schedule-count">
                    {selectedCount} session{selectedCount === 1 ? "" : "s"} selected
                  </span>
                </div>

                <div className="schedule-header-actions">
                  <button
                    type="button"
                    className="btn-text-subtle"
                    onClick={() => handleSelectAll(true)}
                  >
                    Select All
                  </button>
                  <span className="divider-dot">•</span>
                  <button
                    type="button"
                    className="btn-text-subtle"
                    onClick={() => handleSelectAll(false)}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Schedule Days Grid */}
              <div className="planner-days-list">
                {plan.schedule.map((day) => (
                  <div key={day.dayNumber} className="planner-day-card">
                    <div className="day-card-header">
                      <div className="day-meta">
                        <span className="day-badge">{day.dayLabel}</span>
                        <span className="day-date">{day.date}</span>
                      </div>
                      <span className="day-theme">{day.theme}</span>
                    </div>

                    <div className="day-sessions-list">
                      {day.items.map((item) => {
                        const isAdded = addedItemIds.has(item.id);
                        const isChecked = Boolean(selectedItems[item.id]);

                        return (
                          <label
                            key={item.id}
                            className={`planner-session-row ${
                              isChecked ? "selected" : ""
                            } ${isAdded ? "already-added" : ""} ${
                              item.isExisting ? "is-existing-task" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={adding || isAdded || item.isExisting}
                              onChange={() => toggleItem(item.id)}
                              aria-label={`Select ${item.task}`}
                            />

                            <div className="session-content">
                              <div className="session-title-line">
                                <span className="session-title">{item.task}</span>
                                {isAdded && (
                                  <span className="session-added-tag">
                                    <FiCheck aria-hidden="true" /> Added
                                  </span>
                                )}
                                {item.isExisting && (
                                  <span className="session-existing-tag">
                                    In Workspace
                                  </span>
                                )}
                              </div>

                              <div className="session-meta">
                                <span className="session-duration">
                                  <FiClock aria-hidden="true" /> {item.duration}
                                </span>

                                <span
                                  className={`priority-badge ${
                                    item.priority === "High"
                                      ? "high"
                                      : item.priority === "Low"
                                        ? "low"
                                        : "medium"
                                  }`}
                                >
                                  <span className="priority-dot" aria-hidden="true" />
                                  <span className="priority-dot" aria-hidden="true" />
                                  <span className="priority-dot" aria-hidden="true" />
                                  {item.priority}
                                </span>

                                <span className="session-phase">{item.phase}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Workspace Ingestion Action Bar */}
              <div className="planner-footer-action-bar">
                <div className="planner-footer-summary">
                  <strong>{selectedCount} tasks ready</strong>
                  <span>
                    Add directly to your workspace with calculated due dates and priorities.
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-add-plan-tasks"
                  disabled={adding || selectedCount === 0}
                  onClick={handleAddSelectedToWorkspace}
                >
                  {adding ? (
                    "Adding to Workspace..."
                  ) : (
                    <>
                      <FiPlus aria-hidden="true" /> Add {selectedCount} Tasks to Workspace
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: SMART RESCHEDULING ==================== */}
      {activeTab === "reschedule" && (
        <div className="planner-tab-content">
          <div className="reschedule-config-bar">
            <div className="reschedule-config-group">
              <label htmlFor="reschedule-capacity">Daily Study Limit</label>
              <select
                id="reschedule-capacity"
                className="workspace-select"
                value={rescheduleCapacity}
                disabled={rescheduleLoading || applyingReschedule}
                onChange={(e) => setRescheduleCapacity(Number(e.target.value))}
              >
                <option value={1}>1 hour / day</option>
                <option value={2}>2 hours / day</option>
                <option value={3}>3 hours / day (Default)</option>
                <option value={4}>4 hours / day</option>
                <option value={5}>5 hours / day</option>
                <option value={6}>6 hours / day</option>
              </select>
            </div>

            <div className="reschedule-config-group">
              <label htmlFor="reschedule-horizon">Schedule Horizon</label>
              <select
                id="reschedule-horizon"
                className="workspace-select"
                value={rescheduleHorizon}
                disabled={rescheduleLoading || applyingReschedule}
                onChange={(e) => setRescheduleHorizon(Number(e.target.value))}
              >
                <option value={3}>Next 3 Days</option>
                <option value={5}>Next 5 Days</option>
                <option value={7}>Next 7 Days (1 Week)</option>
                <option value={14}>Next 14 Days (2 Weeks)</option>
              </select>
            </div>

            <div className="reschedule-config-group">
              <label htmlFor="reschedule-deadline">Hard Deadline (Optional)</label>
              <input
                id="reschedule-deadline"
                type="date"
                className="workspace-input-date"
                value={hardDeadline}
                disabled={rescheduleLoading || applyingReschedule}
                onChange={(e) => setHardDeadline(e.target.value)}
              />
            </div>

            <div className="reschedule-config-action">
              <label className="reschedule-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeAllIncomplete}
                  disabled={rescheduleLoading || applyingReschedule}
                  onChange={(e) => setIncludeAllIncomplete(e.target.checked)}
                />
                Include all incomplete tasks
              </label>

              <button
                type="button"
                className="btn btn-primary btn-review-schedule"
                disabled={rescheduleLoading || applyingReschedule}
                onClick={handleReviewSchedule}
              >
                {rescheduleLoading ? (
                  "Analyzing Schedule..."
                ) : (
                  <>
                    <FiRefreshCw aria-hidden="true" /> Review My Schedule
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status Feedback */}
          {rescheduleError && (
            <div className="form-error planner-alert" role="alert">
              <><FiAlertCircle aria-hidden="true" /><span>{rescheduleError}</span></>
            </div>
          )}

          {rescheduleSuccess && (
            <div className="form-success planner-alert" role="status">
              <><FiCheckCircle aria-hidden="true" /><span>{rescheduleSuccess}</span></>
            </div>
          )}

          {/* Reschedule Loading State */}
          {rescheduleLoading && (
            <div className="planner-loading-state">
              <div className="ai-spinner" aria-hidden="true" />
              <p>Analyzing priority weights, estimating task efforts, and optimizing daily capacity...</p>
            </div>
          )}

          {/* Empty / On-Track State when user has no overdue tasks and hasn't reviewed yet */}
          {!reschedulePlan && !rescheduleLoading && overdueTasksCount === 0 && (
            <div className="planner-empty-state">
              <div className="empty-state-icon"><FiCheckCircle /></div>
              <h4>All Scheduled Tasks are On Track!</h4>
              <p>
                No overdue tasks were detected in your workspace. You can click <strong>"Review My Schedule"</strong> with <em>"Include all incomplete tasks"</em> checked to redistribute active work evenly across future days.
              </p>
            </div>
          )}

          {/* Overdue Alert Banner when tasks need rescheduling */}
          {!reschedulePlan && !rescheduleLoading && overdueTasksCount > 0 && (
            <div className="reschedule-callout-banner">
              <div className="callout-icon">
                <FiClock aria-hidden="true" />
              </div>
              <div className="callout-content">
                <strong>{overdueTasksCount} task{overdueTasksCount === 1 ? " is" : "s are"} past due date</strong>
                <p>
                  TaskFlow can re-balance your missed sessions across future days according to priority and your {rescheduleCapacity}h/day study budget.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleReviewSchedule}
              >
                Auto-Balance Workload
              </button>
            </div>
          )}

          {/* Rescheduling Recommendations Preview */}
          {reschedulePlan && !rescheduleLoading && (
            <div className="reschedule-results">
              {/* Summary Metrics */}
              <div className="planner-metrics-grid">
                <div className="planner-metric-card">
                  <span className="metric-label">Overdue Tasks</span>
                  <strong className="metric-value">{reschedulePlan.summary.totalOverdueCount}</strong>
                </div>

                <div className="planner-metric-card">
                  <span className="metric-label">Re-balanced</span>
                  <strong className="metric-value">{reschedulePlan.summary.rescheduledCount} Tasks</strong>
                </div>

                <div className="planner-metric-card">
                  <span className="metric-label">Backlog Effort</span>
                  <strong className="metric-value">{reschedulePlan.summary.totalHoursNeeded} Hours</strong>
                </div>

                <div className="planner-metric-card">
                  <span className="metric-label">Conflicts Detected</span>
                  <strong className={`metric-value ${reschedulePlan.summary.conflictCount > 0 ? "has-conflicts" : ""}`}>
                    {reschedulePlan.summary.conflictCount}
                  </strong>
                </div>
              </div>

              {/* Conflict Explanation Banner */}
              {reschedulePlan.summary.hasConflicts && (
                <div className="reschedule-conflict-banner" role="alert">
                  <div className="conflict-icon">
                    <FiAlertTriangle aria-hidden="true" />
                  </div>
                  <div className="conflict-text">
                    <strong>Capacity or Deadline Conflicts Detected</strong>
                    <p>
                      {reschedulePlan.conflicts.length} task{reschedulePlan.conflicts.length === 1 ? "" : "s"} could not fit within the {reschedulePlan.summary.maxDaysAhead}-day window at {reschedulePlan.summary.dailyCapacityHours}h/day without exceeding your daily workload. Consider increasing your daily limit or extending the schedule horizon.
                    </p>
                  </div>
                </div>
              )}

              {/* Recommendations Table Header */}
              <div className="planner-schedule-header">
                <div className="schedule-header-left">
                  <h4>Proposed Task Adjustments</h4>
                  <span className="schedule-count">
                    {selectedRescheduleCount} of {reschedulePlan.summary.rescheduledCount} updates selected
                  </span>
                </div>

                <div className="schedule-header-actions">
                  <button
                    type="button"
                    className="btn-text-subtle"
                    onClick={() => handleSelectAllReschedules(true)}
                  >
                    Select All Achievable
                  </button>
                  <span className="divider-dot">•</span>
                  <button
                    type="button"
                    className="btn-text-subtle"
                    onClick={() => handleSelectAllReschedules(false)}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Recommendation Items List */}
              <div className="reschedule-items-list">
                {reschedulePlan.recommendations.map((rec) => {
                  const isConflict = rec.status === "conflict";
                  const isChecked = Boolean(selectedRescheduleIds[rec.taskId]);

                  return (
                    <div
                      key={rec.taskId}
                      className={`reschedule-card ${isChecked ? "selected" : ""} ${isConflict ? "is-conflict" : ""}`}
                    >
                      <div className="reschedule-card-top">
                        <label className="reschedule-select-checkbox">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isConflict || applyingReschedule}
                            onChange={() => toggleRescheduleSelection(rec.taskId)}
                            aria-label={`Select rescheduling for ${rec.task}`}
                          />
                          <span className="reschedule-task-title">{rec.task}</span>
                        </label>

                        <div className="reschedule-badges">
                          <span className="session-duration">
                            <FiClock aria-hidden="true" /> {rec.estimatedMinutes}m
                          </span>

                          <span
                            className={`priority-badge ${
                              rec.priority === "High"
                                ? "high"
                                : rec.priority === "Low"
                                  ? "low"
                                  : "medium"
                            }`}
                          >
                            <span className="priority-dot" aria-hidden="true" />
                            {rec.priority}
                          </span>
                        </div>
                      </div>

                      {/* Date Transition Row */}
                      <div className="reschedule-date-transition">
                        <div className="date-box date-old">
                          <span className="date-box-label">Original Due</span>
                          <span className="date-box-val">
                            {rec.originalDueDate ? rec.originalDueDate : "No Date"}
                          </span>
                          <span className="tag-overdue">Overdue</span>
                        </div>

                        <span className="date-transition-arrow" aria-hidden="true">
                          →
                        </span>

                        <div className={`date-box date-new ${isConflict ? "conflict-box" : ""}`}>
                          <span className="date-box-label">Proposed New Date</span>
                          <span className="date-box-val">
                            {rec.proposedDueDate ? `${rec.proposedDueDate} (${rec.dayLabel})` : "Unscheduled"}
                          </span>
                        </div>
                      </div>

                      {/* Justification / Reason */}
                      <div className={`reschedule-reason ${isConflict ? "conflict-reason" : ""}`}>
                        {isConflict ? (
                          <span><FiAlertTriangle className="conflict-svg" /> {rec.reason}</span>
                        ) : (
                          <span><FiInfo className="info-svg" /> {rec.reason}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Confirmation Bar */}
              <div className="planner-footer-action-bar">
                <div className="planner-footer-summary">
                  <strong>{selectedRescheduleCount} tasks ready to reschedule</strong>
                  <span>
                    Only selected tasks will be updated in your database. Original task records and completions remain untouched.
                  </span>
                </div>

                <div className="reschedule-footer-buttons">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={applyingReschedule}
                    onClick={handleCancelReschedule}
                  >
                    <FiX aria-hidden="true" /> Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-apply-reschedule"
                    disabled={applyingReschedule || selectedRescheduleCount === 0}
                    onClick={handleApplyReschedule}
                  >
                    {applyingReschedule ? (
                      "Applying Changes..."
                    ) : (
                      <>
                        <FiCheck aria-hidden="true" /> Apply {selectedRescheduleCount} Updates
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default DailyPlanner;
