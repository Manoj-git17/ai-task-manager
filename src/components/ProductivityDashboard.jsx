import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import {
  FiTrendingUp,
  FiTarget,
  FiAward,
  FiClock,
  FiPlus,
  FiTrash2,
  FiAlertTriangle,
  FiZap,
  FiChevronRight,
  FiCheckCircle,
  FiActivity,
  FiAlertCircle,
  FiX,
  FiCalendar,
} from "react-icons/fi";

function ProductivityDashboard({ tasks = [], onNavigate }) {
  const [analytics, setAnalytics] = useState(null);
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState("");

  // Goal Creation Modal State
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTargetCount, setGoalTargetCount] = useState(5);
  const [goalCategory, setGoalCategory] = useState("all");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  // Hover state for interactive SVG chart
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);

  const API_URL = (
    import.meta.env.VITE_API_URL || "/api"
  ).replace(/\/+$/, "");

  // Load analytics & goals from backend
  const fetchAnalytics = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [analyticsRes, goalsRes] = await Promise.all([
        fetch(`${API_URL}/analytics`, { headers }),
        fetch(`${API_URL}/goals`, { headers }),
      ]);

      if (analyticsRes.status === 401 || goalsRes.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return;
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        if (data.success) {
          setAnalytics(data);
        }
      }

      if (goalsRes.ok) {
        const data = await goalsRes.json();
        if (data.success && Array.isArray(data.goals)) {
          setGoals(data.goals);
        }
      }
    } catch (err) {
      console.error("Failed to load productivity analytics:", err);
      setError("Could not load latest analytics from server.");
    }
  }, [API_URL]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      const token = localStorage.getItem("token");
      if (!token || ignore) return;
      await fetchAnalytics();
    };
    load();
    return () => {
      ignore = true;
    };
  }, [fetchAnalytics, tasks.length]);

  // Handle Goal Creation
  async function handleCreateGoal(e) {
    if (e) e.preventDefault();
    const trimmedTitle = goalTitle.trim();
    if (!trimmedTitle) {
      toast.warning("Please enter a goal title.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    setSavingGoal(true);
    try {
      const response = await fetch(`${API_URL}/goals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: trimmedTitle,
          targetCount: Number(goalTargetCount) || 5,
          category: goalCategory,
          targetDate: goalTargetDate || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create goal.");
      }

      toast.success("Goal target created successfully!");
      setGoalTitle("");
      setGoalTargetCount(5);
      setGoalCategory("all");
      setGoalTargetDate("");
      setShowGoalModal(false);

      await fetchAnalytics();
    } catch (err) {
      console.error("Create goal error:", err);
      toast.error(err.message || "Could not save goal.");
    } finally {
      setSavingGoal(false);
    }
  }

  // Handle Goal Deletion
  async function handleDeleteGoal(goalId) {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/goals/${goalId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.info("Goal removed.");
        setGoals((prev) => prev.filter((g) => g.id !== goalId));
        await fetchAnalytics();
      }
    } catch (err) {
      console.error("Delete goal error:", err);
      toast.error("Failed to delete goal.");
    }
  }

  // Safe fallback metrics if loading or server delay
  const overview = analytics?.overview || {
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => Number(t.completed) === 1).length,
    pendingTasks: tasks.filter((t) => Number(t.completed) !== 1).length,
    overdueTasks: 0,
    completionRate:
      tasks.length > 0
        ? Math.round(
            (tasks.filter((t) => Number(t.completed) === 1).length /
              tasks.length) *
              100
          )
        : 0,
    completedToday: 0,
    completedThisWeek: 0,
    workloadHours: 0,
  };

  const streaks = analytics?.streaks || {
    currentStreak: 0,
    longestStreak: 0,
    activeDaysThisWeek: 0,
  };

  const weeklyTrends = useMemo(
    () => analytics?.weeklyTrends || [],
    [analytics?.weeklyTrends]
  );

  const maxTrendValue = useMemo(() => {
    if (!weeklyTrends || weeklyTrends.length === 0) return 4;
    const maxVal = Math.max(...weeklyTrends.map((d) => d.completed || 0), 1);
    return Math.max(maxVal, 4);
  }, [weeklyTrends]);

  const priorities = analytics?.priorities || {
    High: { total: 0, completed: 0, pending: 0, percentage: 0 },
    Medium: { total: 0, completed: 0, pending: 0, percentage: 0 },
    Low: { total: 0, completed: 0, pending: 0, percentage: 0 },
  };

  const insights = analytics?.insights || [];
  const upcomingDeadlines = analytics?.upcomingDeadlines || [];

  return (
    <div className="pi-container" aria-labelledby="productivity-heading">
      {/* =========================================================================
          1. EDITORIAL HEADER & QUICK ACTION
          ========================================================================= */}
      <header className="pi-header">
        <div className="pi-header-content">
          <div className="pi-eyebrow">
            <span className="pi-badge">
              <FiTrendingUp aria-hidden="true" />
              <span>Analytics Studio</span>
            </span>
            <span className="pi-status-live">
              <span className="pi-live-dot" /> Live Telemetry
            </span>
          </div>

          <h2 id="productivity-heading" className="pi-title">
            Productivity Intelligence & Velocity
          </h2>

          <p className="pi-subtitle">
            Real-time execution velocity, cadence streaks, priority distribution,
            and milestone targets calculated directly from authenticated task history.
          </p>
        </div>

        <div className="pi-header-actions">
          <button
            type="button"
            className="pi-btn-new-goal"
            onClick={() => setShowGoalModal(true)}
            title="Set a weekly milestone target"
          >
            <FiTarget aria-hidden="true" />
            <span>+ Set Goal</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="pi-alert-error" role="alert">
          <FiAlertCircle aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          2. UNIFIED EXECUTIVE KPI HORIZON (Refined Single-Surface Deck)
          ========================================================================= */}
      <section className="pi-kpi-deck" aria-label="Key Performance Indicators">
        {/* KPI 1: Overall Completion */}
        <div className="pi-kpi-cell">
          <div className="pi-kpi-cell-top">
            <span className="pi-kpi-label">OVERALL COMPLETION</span>
            <div className="pi-kpi-icon-wrap violet">
              <FiCheckCircle aria-hidden="true" />
            </div>
          </div>
          <div className="pi-kpi-value-row">
            <span className="pi-kpi-num">{overview.completionRate}%</span>
          </div>
          <div className="pi-kpi-progress-bar">
            <div
              className="pi-kpi-progress-fill"
              style={{ width: `${overview.completionRate}%` }}
            />
          </div>
          <span className="pi-kpi-subtext">
            {overview.completedTasks} of {overview.totalTasks} tasks resolved
          </span>
        </div>

        <div className="pi-kpi-divider" aria-hidden="true" />

        {/* KPI 2: Consistency Streak */}
        <div className="pi-kpi-cell">
          <div className="pi-kpi-cell-top">
            <span className="pi-kpi-label">CADENCE STREAK</span>
            <div className="pi-kpi-icon-wrap amber">
              <FiActivity aria-hidden="true" />
            </div>
          </div>
          <div className="pi-kpi-value-row">
            <span className="pi-kpi-num">
              {streaks.currentStreak} <span className="pi-kpi-unit">Day{streaks.currentStreak === 1 ? "" : "s"}</span>
            </span>
          </div>
          <div className="pi-kpi-tag-row">
            <span className="pi-streak-pill">
              {streaks.activeDaysThisWeek} of 7 active days this week
            </span>
          </div>
          <span className="pi-kpi-subtext">
            Personal best: {streaks.longestStreak} days
          </span>
        </div>

        <div className="pi-kpi-divider" aria-hidden="true" />

        {/* KPI 3: Completed Velocity */}
        <div className="pi-kpi-cell">
          <div className="pi-kpi-cell-top">
            <span className="pi-kpi-label">COMPLETED VELOCITY</span>
            <div className="pi-kpi-icon-wrap emerald">
              <FiAward aria-hidden="true" />
            </div>
          </div>
          <div className="pi-kpi-value-row">
            <span className="pi-kpi-num">{overview.completedThisWeek}</span>
            <span className="pi-kpi-unit">past 7 days</span>
          </div>
          <div className="pi-kpi-tag-row">
            <span className="pi-velocity-pill">
              {overview.completedToday} completed today
            </span>
          </div>
          <span className="pi-kpi-subtext">
            {overview.completedThisWeek > 0
              ? "Healthy velocity cadence"
              : "Ready to log completions"}
          </span>
        </div>

        <div className="pi-kpi-divider" aria-hidden="true" />

        {/* KPI 4: Active Workload */}
        <div className="pi-kpi-cell">
          <div className="pi-kpi-cell-top">
            <span className="pi-kpi-label">ACTIVE WORKLOAD</span>
            <div className="pi-kpi-icon-wrap cyan">
              <FiClock aria-hidden="true" />
            </div>
          </div>
          <div className="pi-kpi-value-row">
            <span className="pi-kpi-num">~{overview.workloadHours}h</span>
          </div>
          <div className="pi-kpi-tag-row">
            <span className={`pi-workload-pill ${overview.overdueTasks > 0 ? "urgent" : ""}`}>
              {overview.pendingTasks} pending {overview.overdueTasks > 0 && `(${overview.overdueTasks} overdue)`}
            </span>
          </div>
          <span className="pi-kpi-subtext">
            ~{Math.ceil(overview.workloadHours / 3)}d estimated at 3h/day
          </span>
        </div>
      </section>

      {/* =========================================================================
          3. CHARTS ROW (Weekly Velocity SVG + Priority Distribution)
          ========================================================================= */}
      <div className="pi-charts-row">
        {/* Weekly Completion Trends SVG Chart */}
        <section className="pi-chart-card" aria-label="Weekly Completion Velocity Chart">
          <div className="pi-card-header">
            <div>
              <h3 className="pi-card-title">Weekly Completion Velocity</h3>
              <p className="pi-card-desc">Daily finished task completions across past 7 calendar days.</p>
            </div>
            <span className="pi-stat-summary-pill">
              {overview.completedThisWeek} finished this week
            </span>
          </div>

          <div className="pi-svg-chart-wrapper">
            <svg
              className="pi-weekly-chart"
              viewBox="0 0 500 170"
              preserveAspectRatio="none"
              aria-label="Weekly task completion bar chart"
            >
              {/* Background Gridlines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="var(--tf-border-subtle, rgba(255,255,255,0.06))" strokeDasharray="3 3" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="var(--tf-border-subtle, rgba(255,255,255,0.06))" strokeDasharray="3 3" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="var(--tf-border, rgba(255,255,255,0.08))" />

              {/* Y Axis Labels */}
              <text x="32" y="24" fill="var(--tf-text-muted, #94a3b8)" fontSize="10" textAnchor="end" fontFamily="var(--font-mono, monospace)">
                {maxTrendValue}
              </text>
              <text x="32" y="74" fill="var(--tf-text-muted, #94a3b8)" fontSize="10" textAnchor="end" fontFamily="var(--font-mono, monospace)">
                {Math.round(maxTrendValue / 2)}
              </text>
              <text x="32" y="124" fill="var(--tf-text-muted, #94a3b8)" fontSize="10" textAnchor="end" fontFamily="var(--font-mono, monospace)">
                0
              </text>

              {/* Daily Bar Columns */}
              {weeklyTrends.map((d, index) => {
                const totalWidth = 430;
                const barSpacing = totalWidth / 7;
                const xPos = 55 + index * barSpacing;
                const barWidth = 32;
                const maxBarHeight = 98;
                const hasCompletions = d.completed > 0;
                const barHeight = hasCompletions
                  ? Math.max(12, Math.round((d.completed / maxTrendValue) * maxBarHeight))
                  : 4;
                const yPos = 120 - barHeight;
                const isToday = index === weeklyTrends.length - 1;
                const isHovered = hoveredBarIndex === index;

                return (
                  <g
                    key={d.date || index}
                    className={`pi-bar-group ${isHovered ? "is-hovered" : ""}`}
                    onMouseEnter={() => setHoveredBarIndex(index)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                  >
                    {/* Transparent Full-Height Hitbox */}
                    <rect
                      x={xPos - 6}
                      y="15"
                      width={barWidth + 12}
                      height="125"
                      fill="transparent"
                      className="pi-hitbox"
                    />

                    {/* Column Hover Highlight */}
                    {isHovered && (
                      <rect
                        x={xPos - 4}
                        y="15"
                        width={barWidth + 8}
                        height="105"
                        fill="rgba(139, 92, 246, 0.08)"
                        rx="6"
                      />
                    )}

                    {/* Bar Geometry */}
                    <rect
                      x={xPos}
                      y={yPos}
                      width={barWidth}
                      height={barHeight}
                      rx="5"
                      className={`pi-chart-bar ${isToday ? "is-today" : ""} ${hasCompletions ? "has-data" : "zero-data"}`}
                    />

                    {/* Value Badge above bar if completions > 0 */}
                    {hasCompletions && (
                      <text
                        x={xPos + barWidth / 2}
                        y={yPos - 6}
                        fill={isToday ? "var(--tf-accent-violet, #8b5cf6)" : "var(--tf-text-primary, #f8fafc)"}
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="middle"
                        fontFamily="var(--font-mono, monospace)"
                      >
                        {d.completed}
                      </text>
                    )}

                    {/* X Axis Day Name */}
                    <text
                      x={xPos + barWidth / 2}
                      y="144"
                      fill={isToday ? "var(--tf-accent-violet, #8b5cf6)" : "var(--tf-text-secondary, #94a3b8)"}
                      fontSize="11"
                      fontWeight={isToday ? "700" : "500"}
                      textAnchor="middle"
                    >
                      {d.dayLabel}
                    </text>

                    {/* Relative Today Pip */}
                    {isToday && (
                      <circle
                        cx={xPos + barWidth / 2}
                        cy="156"
                        r="2.5"
                        fill="var(--tf-accent-violet, #8b5cf6)"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredBarIndex !== null && weeklyTrends[hoveredBarIndex] && (
              <div className="pi-chart-tooltip">
                <span className="tooltip-date">{weeklyTrends[hoveredBarIndex].dayLabel} ({weeklyTrends[hoveredBarIndex].date})</span>
                <span className="tooltip-count">
                  <strong>{weeklyTrends[hoveredBarIndex].completed}</strong> task{weeklyTrends[hoveredBarIndex].completed === 1 ? "" : "s"} finished
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Priority Distribution & Upcoming Deadlines Card */}
        <section className="pi-priority-card" aria-label="Priority Distribution">
          <div className="pi-card-header">
            <div>
              <h3 className="pi-card-title">Priority Distribution</h3>
              <p className="pi-card-desc">Workload density segmented by urgency tier.</p>
            </div>
          </div>

          {/* Proportional Segmented Spectrum Bar */}
          <div className="pi-spectrum-bar" title="Priority Breakdown">
            {priorities.High.percentage > 0 && (
              <div
                className="pi-spectrum-segment seg-high"
                style={{ width: `${priorities.High.percentage}%` }}
                title={`High: ${priorities.High.percentage}% (${priorities.High.total} tasks)`}
              />
            )}
            {priorities.Medium.percentage > 0 && (
              <div
                className="pi-spectrum-segment seg-medium"
                style={{ width: `${priorities.Medium.percentage}%` }}
                title={`Medium: ${priorities.Medium.percentage}% (${priorities.Medium.total} tasks)`}
              />
            )}
            {priorities.Low.percentage > 0 && (
              <div
                className="pi-spectrum-segment seg-low"
                style={{ width: `${priorities.Low.percentage}%` }}
                title={`Low: ${priorities.Low.percentage}% (${priorities.Low.total} tasks)`}
              />
            )}
          </div>

          {/* Detailed Priority Rows */}
          <div className="pi-priority-list">
            <div className="pi-priority-row">
              <div className="pi-prio-left">
                <span className="pi-prio-dot high" />
                <span className="pi-prio-name">High Priority</span>
              </div>
              <span className="pi-prio-detail">
                {priorities.High.total} total · <span className="text-muted">{priorities.High.pending} pending</span>
              </span>
              <span className="pi-prio-pct high">{priorities.High.percentage}%</span>
            </div>

            <div className="pi-priority-row">
              <div className="pi-prio-left">
                <span className="pi-prio-dot medium" />
                <span className="pi-prio-name">Medium Priority</span>
              </div>
              <span className="pi-prio-detail">
                {priorities.Medium.total} total · <span className="text-muted">{priorities.Medium.pending} pending</span>
              </span>
              <span className="pi-prio-pct medium">{priorities.Medium.percentage}%</span>
            </div>

            <div className="pi-priority-row">
              <div className="pi-prio-left">
                <span className="pi-prio-dot low" />
                <span className="pi-prio-name">Low Priority</span>
              </div>
              <span className="pi-prio-detail">
                {priorities.Low.total} total · <span className="text-muted">{priorities.Low.pending} pending</span>
              </span>
              <span className="pi-prio-pct low">{priorities.Low.percentage}%</span>
            </div>
          </div>

          {/* Upcoming Deadlines Quick Peek */}
          {upcomingDeadlines.length > 0 && (
            <div className="pi-deadlines-preview">
              <span className="pi-deadlines-label">APPROACHING DEADLINES</span>
              <div className="pi-deadlines-chips">
                {upcomingDeadlines.slice(0, 3).map((t) => (
                  <span key={t.id} className="pi-deadline-chip">
                    <span className="chip-date">{t.dueDate?.slice(5)}</span>
                    <span className="chip-title">{t.task}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* =========================================================================
          4. WEEKLY PRODUCTIVITY GOALS (Refined Compact Layout)
          ========================================================================= */}
      <section className="pi-goals-card" aria-label="Weekly Productivity Goals">
        <div className="pi-card-header">
          <div className="pi-header-group">
            <div className="pi-card-icon-circle">
              <FiTarget aria-hidden="true" />
            </div>
            <div>
              <h3 className="pi-card-title">Weekly Productivity Targets</h3>
              <p className="pi-card-desc">Objective targets measured against live database completion records.</p>
            </div>
          </div>

          <button
            type="button"
            className="pi-btn-add-goal-subtle"
            onClick={() => setShowGoalModal(true)}
          >
            <FiPlus aria-hidden="true" />
            <span>Add Target</span>
          </button>
        </div>

        {goals.length === 0 ? (
          <div className="pi-goals-empty-compact">
            <div className="pi-empty-target-icon">
              <FiTarget aria-hidden="true" />
            </div>
            <div className="pi-empty-text-wrap">
              <strong>No active weekly goals configured</strong>
              <p>Establish a target (e.g., "Resolve 5 High-Priority Tasks") to track milestone velocity.</p>
            </div>
            <button
              type="button"
              className="pi-btn-create-first"
              onClick={() => setShowGoalModal(true)}
            >
              Set First Goal
            </button>
          </div>
        ) : (
          <div className="pi-goals-grid">
            {goals.map((g) => {
              const isCompleted = g.status === "completed" || g.progressPercentage >= 100;

              return (
                <div key={g.id} className={`pi-goal-item ${isCompleted ? "is-finished" : ""}`}>
                  <div className="pi-goal-item-top">
                    <div className="pi-goal-info">
                      <span className="pi-goal-title">{g.title}</span>
                      <div className="pi-goal-tags">
                        <span className="pi-goal-tag category">
                          {g.category === "all" ? "All Tasks" : `${g.category} Priority`}
                        </span>
                        {g.targetDate && (
                          <span className="pi-goal-tag date">
                            <FiCalendar /> {g.targetDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="pi-btn-delete-goal"
                      title="Remove goal"
                      aria-label={`Remove goal ${g.title}`}
                      onClick={() => handleDeleteGoal(g.id)}
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>

                  <div className="pi-goal-progress-wrap">
                    <div className="pi-goal-bar-track">
                      <div
                        className={`pi-goal-bar-fill ${isCompleted ? "completed" : ""}`}
                        style={{ width: `${Math.min(100, g.progressPercentage)}%` }}
                      />
                    </div>

                    <div className="pi-goal-meta-row">
                      <span className="pi-goal-counts">
                        <strong>{g.currentCount}</strong> of {g.targetCount} completed
                        {!isCompleted && ` (${g.remainingCount} remaining)`}
                      </span>
                      <span className={`pi-goal-status-badge ${isCompleted ? "finished" : ""}`}>
                        {isCompleted ? "Target Achieved 🎯" : `${g.progressPercentage}%`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          5. ACTIONABLE PRODUCTIVITY INSIGHTS (Categorized Hierarchy)
          ========================================================================= */}
      <section className="pi-insights-card" aria-label="Actionable Productivity Insights">
        <div className="pi-card-header">
          <div className="pi-header-group">
            <div className="pi-card-icon-circle amber">
              <FiZap aria-hidden="true" />
            </div>
            <div>
              <h3 className="pi-card-title">Actionable Telemetry Insights</h3>
              <p className="pi-card-desc">Deterministic recommendations synthesized from your active workload.</p>
            </div>
          </div>
        </div>

        <div className="pi-insights-grid">
          {insights.map((insight) => (
            <div key={insight.id} className={`pi-insight-card severity-${insight.severity}`}>
              <div className="pi-insight-header">
                <div className={`pi-insight-icon-box ${insight.severity}`}>
                  {insight.severity === "critical" && <FiAlertTriangle aria-hidden="true" />}
                  {insight.severity === "warning" && <FiClock aria-hidden="true" />}
                  {insight.severity === "positive" && <FiAward aria-hidden="true" />}
                  {insight.severity === "info" && <FiZap aria-hidden="true" />}
                </div>
                <span className="pi-insight-title">{insight.title}</span>
                <span className={`pi-severity-badge ${insight.severity}`}>
                  {insight.severity === "critical" ? "Urgent" : insight.severity === "positive" ? "Velocity" : "Pacing"}
                </span>
              </div>

              <p className="pi-insight-body">{insight.message}</p>

              {insight.actionLabel && (
                <div className="pi-insight-footer">
                  <button
                    type="button"
                    className="pi-btn-insight-action"
                    onClick={() => {
                      if (insight.actionView && typeof onNavigate === "function") {
                        onNavigate(insight.actionView);
                      }
                    }}
                  >
                    <span>{insight.actionLabel}</span>
                    <FiChevronRight aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          6. MODAL: SET PRODUCTIVITY GOAL
          ========================================================================= */}
      {showGoalModal && (
        <div className="tf-modal-backdrop" onClick={() => setShowGoalModal(false)}>
          <div
            className="tf-task-modal-surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-modal-header">
              <div className="tf-modal-title-wrap">
                <FiTarget className="tf-modal-icon-violet" />
                <h3 id="goal-modal-title">Set Productivity Target</h3>
              </div>
              <button
                type="button"
                className="tf-modal-close"
                onClick={() => setShowGoalModal(false)}
                aria-label="Close dialog"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="tf-edit-modal-form">
              <div className="tf-edit-field">
                <label htmlFor="goal-title-input">Target Objective</label>
                <input
                  id="goal-title-input"
                  type="text"
                  className="tf-edit-input"
                  placeholder="e.g., Complete 5 High Priority Tasks this week"
                  value={goalTitle}
                  required
                  maxLength={100}
                  autoComplete="off"
                  onChange={(e) => setGoalTitle(e.target.value)}
                />
              </div>

              <div className="tf-edit-row">
                <div className="tf-edit-field">
                  <label htmlFor="goal-target-num">Target Tasks</label>
                  <input
                    id="goal-target-num"
                    type="number"
                    min={1}
                    max={50}
                    className="tf-edit-input"
                    value={goalTargetCount}
                    onChange={(e) => setGoalTargetCount(e.target.value)}
                  />
                </div>

                <div className="tf-edit-field">
                  <label htmlFor="goal-cat-select">Category</label>
                  <select
                    id="goal-cat-select"
                    className="tf-edit-select"
                    value={goalCategory}
                    onChange={(e) => setGoalCategory(e.target.value)}
                  >
                    <option value="all">Any Task</option>
                    <option value="High">High Priority Only</option>
                    <option value="Medium">Medium Priority Only</option>
                    <option value="Low">Low Priority Only</option>
                  </select>
                </div>

                <div className="tf-edit-field">
                  <label htmlFor="goal-date-input">Target Date</label>
                  <input
                    id="goal-date-input"
                    type="date"
                    className="tf-edit-date"
                    value={goalTargetDate}
                    onChange={(e) => setGoalTargetDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="tf-modal-actions">
                <button
                  type="button"
                  className="tf-btn-modal-cancel"
                  onClick={() => setShowGoalModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-btn-modal-save"
                  disabled={savingGoal || !goalTitle.trim()}
                >
                  {savingGoal ? "Saving..." : "Create Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductivityDashboard;
