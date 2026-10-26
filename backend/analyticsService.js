/**
 * TaskFlow Productivity Intelligence Service
 * Deterministically computes productivity metrics, weekly trends, streaks,
 * goal progress, and actionable rule-based insights from real task records.
 */

const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseTaskDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Calculates current and longest consistency streaks based on actual task activity dates.
 */
function calculateStreaks(tasks = [], referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  const todayISO = formatDateISO(ref);

  const yesterday = new Date(ref);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = formatDateISO(yesterday);

  // Collect unique dates on which user completed or created a task
  const activityDatesSet = new Set();

  for (const t of tasks) {
    // Prefer completion date if completed
    if ((Number(t.completed) === 1 || t.completed === true) && t.completedAt) {
      const d = parseTaskDate(t.completedAt);
      if (d) activityDatesSet.add(formatDateISO(d));
    } else if (Number(t.completed) === 1 || t.completed === true) {
      // Fallback for completed task without explicit completedAt
      const d = parseTaskDate(t.createdAt);
      if (d) activityDatesSet.add(formatDateISO(d));
    }
  }

  const sortedDates = Array.from(activityDatesSet).sort();

  if (sortedDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      activeDaysThisWeek: 0,
      lastActiveDate: null,
      activityDates: [],
    };
  }

  // 1. Calculate Longest Streak
  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentRun++;
      if (currentRun > longestStreak) {
        longestStreak = currentRun;
      }
    } else if (diffDays > 1) {
      currentRun = 1;
    }
  }

  // 2. Calculate Current Streak
  let currentStreak = 0;
  const hasActivityToday = activityDatesSet.has(todayISO);
  const hasActivityYesterday = activityDatesSet.has(yesterdayISO);

  if (hasActivityToday || hasActivityYesterday) {
    currentStreak = 1;
    let checkDate = new Date(hasActivityToday ? ref : yesterday);

    while (true) {
      checkDate.setDate(checkDate.getDate() - 1);
      const checkISO = formatDateISO(checkDate);
      if (activityDatesSet.has(checkISO)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // 3. Active days in the current week (Monday to Sunday)
  const dayOfWeek = ref.getDay();
  const distToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(ref);
  monday.setDate(monday.getDate() - distToMonday);
  monday.setHours(0, 0, 0, 0);

  let activeDaysThisWeek = 0;
  for (let d = 0; d < 7; d++) {
    const target = new Date(monday);
    target.setDate(target.getDate() + d);
    if (activityDatesSet.has(formatDateISO(target))) {
      activeDaysThisWeek++;
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    activeDaysThisWeek,
    lastActiveDate: sortedDates[sortedDates.length - 1],
    activityDates: sortedDates,
  };
}

/**
 * Calculates weekly completion and creation trends over the past 7 days.
 */
function calculateWeeklyTrends(tasks = [], referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const past7Days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref);
    d.setDate(d.getDate() - i);
    const dateISO = formatDateISO(d);
    const dayName = dayNamesShort[d.getDay()];

    const completedOnDay = tasks.filter((t) => {
      const isCompleted = Number(t.completed) === 1 || t.completed === true;
      if (!isCompleted) return false;
      const compDate = t.completedAt ? formatDateISO(new Date(t.completedAt)) : (t.createdAt ? formatDateISO(new Date(t.createdAt)) : null);
      return compDate === dateISO;
    }).length;

    const createdOnDay = tasks.filter((t) => {
      if (!t.createdAt) return false;
      const cDate = parseTaskDate(t.createdAt);
      return cDate && formatDateISO(cDate) === dateISO;
    }).length;

    past7Days.push({
      date: dateISO,
      dayName,
      dayLabel: i === 0 ? "Today" : (i === 1 ? "Yest" : dayName),
      completed: completedOnDay,
      created: createdOnDay,
    });
  }

  return past7Days;
}

/**
 * Evaluates progress against user-defined goals based on real task completions.
 */
function evaluateGoals(goals = [], tasks = [], referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  return goals.map((goal) => {
    const targetCount = Number(goal.targetCount) || 5;
    const category = String(goal.category || "all").toLowerCase();

    // Count qualifying completed tasks
    const completedMatches = tasks.filter((t) => {
      const isDone = Number(t.completed) === 1 || t.completed === true;
      if (!isDone) return false;

      if (category === "high") {
        return String(t.priority).toLowerCase() === "high";
      }
      if (category === "medium") {
        return String(t.priority).toLowerCase() === "medium";
      }
      if (category === "low") {
        return String(t.priority).toLowerCase() === "low";
      }
      // If category is a specific keyword, check task title
      if (category !== "all" && category.trim()) {
        const title = (t.task || t.title || "").toLowerCase();
        return title.includes(category);
      }
      return true;
    }).length;

    const progressPercentage = Math.min(100, Math.round((completedMatches / targetCount) * 100));
    const remainingCount = Math.max(0, targetCount - completedMatches);
    const isCompleted = completedMatches >= targetCount;

    return {
      id: goal.id,
      title: goal.title,
      targetCount,
      currentCount: completedMatches,
      progressPercentage,
      remainingCount,
      targetDate: goal.targetDate || null,
      category: goal.category || "all",
      status: isCompleted ? "completed" : "in_progress",
    };
  });
}

/**
 * Generates deterministic, rule-based productivity insights based on actual user data.
 */
function generateInsights({
  totalTasks,
  completedTasks,
  pendingTasks,
  overdueTasks,
  completionRate,
  completedThisWeek,
  streaks,
  highPendingCount,
  urgentTasks,
  workloadHours,
}) {
  const insights = [];

  // Insight 1: Overdue Task Warning
  if (overdueTasks.length > 0) {
    const topOverdue = overdueTasks[0];
    insights.push({
      id: "insight-overdue",
      severity: "critical",
      type: "overdue_alert",
      title: `${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? "s" : ""} Require Attention`,
      message: `You have ${overdueTasks.length} task(s) past their deadline. The longest overdue is "${topOverdue.task}". Use Smart Rescheduling to re-balance your workload without cramming.`,
      actionLabel: "Launch Rescheduler",
      actionView: "planner",
    });
  }

  // Insight 2: High-Priority Workload Focus
  if (highPendingCount >= 2 && pendingTasks > 0) {
    const highPct = Math.round((highPendingCount / pendingTasks) * 100);
    insights.push({
      id: "insight-high-priority",
      severity: "warning",
      type: "priority_focus",
      title: `High-Priority Tasks Make Up ${highPct}% of Active Work`,
      message: `You have ${highPendingCount} high-priority tasks in your backlog. Focus on these during your morning deep work sessions before attending to low-priority items.`,
      actionLabel: "View High Priority",
      actionFilter: "High",
    });
  }

  // Insight 3: Approaching Deadlines in 48h
  if (urgentTasks.length > 0) {
    insights.push({
      id: "insight-upcoming-deadlines",
      severity: "warning",
      type: "deadline_proximity",
      title: `${urgentTasks.length} Deadline${urgentTasks.length > 1 ? "s" : ""} Approaching within 48 Hours`,
      message: `Next up: "${urgentTasks.map((t) => t.task).slice(0, 2).join('", "')}"${urgentTasks.length > 2 ? ` and ${urgentTasks.length - 2} more` : ""}. Schedule dedicated focus blocks to ensure timely delivery.`,
      actionLabel: "Check My Tasks",
      actionView: "tasks",
    });
  }

  // Insight 4: Completion Momentum & Consistency Streak
  if (streaks.currentStreak >= 2) {
    insights.push({
      id: "insight-streak",
      severity: "positive",
      type: "streak_momentum",
      title: `Active Consistency Streak: ${streaks.currentStreak} Days`,
      message: `You've maintained consistent productivity for ${streaks.currentStreak} consecutive days! Keep your momentum alive by completing at least one task today.`,
    });
  } else if (completedThisWeek >= 3) {
    insights.push({
      id: "insight-weekly-momentum",
      severity: "positive",
      type: "weekly_velocity",
      title: `Great Weekly Velocity (${completedThisWeek} Completed)`,
      message: `You have completed ${completedThisWeek} tasks across ${streaks.activeDaysThisWeek} active days this week. You're tracking well toward your weekly goals.`,
    });
  }

  // Insight 5: Backlog Workload & Pacing
  if (workloadHours > 8) {
    const daysNeeded = Math.ceil(workloadHours / 3);
    insights.push({
      id: "insight-pacing",
      severity: "info",
      type: "capacity_pacing",
      title: `Estimated Backlog: ~${workloadHours} Hours of Work`,
      message: `At a healthy pace of 3 hours/day, your current unfinished tasks will take approximately ${daysNeeded} days to complete. Distribute milestones evenly to avoid deadline rushes.`,
      actionLabel: "Create Schedule Plan",
      actionView: "planner",
    });
  } else if (totalTasks > 0 && completionRate >= 80) {
    insights.push({
      id: "insight-completion-mastery",
      severity: "positive",
      type: "high_completion",
      title: `Outstanding ${completionRate}% Workspace Completion Rate`,
      message: `You have completed ${completedTasks} of your ${totalTasks} total tasks. Consider setting new ambitious goals in your Daily Planner.`,
    });
  }

  // Fallback insight if workspace is very new
  if (insights.length === 0) {
    insights.push({
      id: "insight-welcome",
      severity: "info",
      type: "onboarding",
      title: "Workspace Intelligence Initializing",
      message: "As you create, schedule, and complete tasks, TaskFlow will continuously analyze your completion patterns to generate personalized workload advice.",
    });
  }

  return insights;
}

/**
 * Main analytics aggregator function
 */
function calculateProductivityAnalytics(tasks = [], goals = [], options = {}) {
  const ref = new Date(options.referenceDate || new Date());
  ref.setHours(0, 0, 0, 0);
  const todayISO = formatDateISO(ref);

  const totalTasks = tasks.length;
  const completedTasksList = tasks.filter((t) => Number(t.completed) === 1 || t.completed === true);
  const completedTasks = completedTasksList.length;
  const pendingTasksList = tasks.filter((t) => Number(t.completed) !== 1 && t.completed !== true);
  const pendingTasks = pendingTasksList.length;

  // Overdue Tasks
  const overdueTasks = pendingTasksList.filter((t) => {
    if (!t.dueDate) return false;
    const d = parseTaskDate(t.dueDate);
    if (!d) return false;
    d.setHours(0, 0, 0, 0);
    return d < ref;
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Completed Today
  const completedToday = completedTasksList.filter((t) => {
    const compDate = t.completedAt ? formatDateISO(new Date(t.completedAt)) : (t.createdAt ? formatDateISO(new Date(t.createdAt)) : null);
    return compDate === todayISO;
  }).length;

  // Completed This Week (Monday onwards)
  const dayOfWeek = ref.getDay();
  const distToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(ref);
  monday.setDate(monday.getDate() - distToMonday);
  monday.setHours(0, 0, 0, 0);

  const completedThisWeek = completedTasksList.filter((t) => {
    const dateStr = t.completedAt || t.createdAt;
    if (!dateStr) return false;
    const d = parseTaskDate(dateStr);
    return d && d >= monday;
  }).length;

  // Weekly Trends (Past 7 Days)
  const weeklyTrends = calculateWeeklyTrends(tasks, ref);

  // Priority Distribution
  const priorityCounts = {
    High: { total: 0, completed: 0, pending: 0, percentage: 0 },
    Medium: { total: 0, completed: 0, pending: 0, percentage: 0 },
    Low: { total: 0, completed: 0, pending: 0, percentage: 0 },
  };

  for (const t of tasks) {
    const pri = ["High", "Medium", "Low"].includes(t.priority) ? t.priority : "Medium";
    priorityCounts[pri].total++;
    if (Number(t.completed) === 1 || t.completed === true) {
      priorityCounts[pri].completed++;
    } else {
      priorityCounts[pri].pending++;
    }
  }

  for (const pri of ["High", "Medium", "Low"]) {
    priorityCounts[pri].percentage = totalTasks > 0 ? Math.round((priorityCounts[pri].total / totalTasks) * 100) : 0;
  }

  // Workload estimation (High = 1.5h, Medium = 1h, Low = 0.5h)
  let workloadHours = 0;
  for (const t of pendingTasksList) {
    if (t.priority === "High") workloadHours += 1.5;
    else if (t.priority === "Low") workloadHours += 0.5;
    else workloadHours += 1.0;
  }

  // Upcoming deadlines in next 7 days
  const sevenDaysAhead = new Date(ref);
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);

  const upcomingDeadlines = pendingTasksList.filter((t) => {
    if (!t.dueDate) return false;
    const d = parseTaskDate(t.dueDate);
    if (!d) return false;
    d.setHours(0, 0, 0, 0);
    return d >= ref && d <= sevenDaysAhead;
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // Urgent in next 48 hours
  const twoDaysAhead = new Date(ref);
  twoDaysAhead.setDate(twoDaysAhead.getDate() + 2);

  const urgentTasks = pendingTasksList.filter((t) => {
    if (!t.dueDate) return false;
    const d = parseTaskDate(t.dueDate);
    if (!d) return false;
    d.setHours(0, 0, 0, 0);
    return d >= ref && d <= twoDaysAhead;
  });

  // Streaks
  const streaks = calculateStreaks(tasks, ref);

  // Goal Progress Evaluation
  const evaluatedGoals = evaluateGoals(goals, tasks, ref);

  // Actionable Insights
  const insights = generateInsights({
    totalTasks,
    completedTasks,
    pendingTasks,
    overdueTasks,
    completionRate,
    completedThisWeek,
    streaks,
    highPendingCount: priorityCounts.High.pending,
    urgentTasks,
    workloadHours: +workloadHours.toFixed(1),
  });

  return {
    overview: {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks: overdueTasks.length,
      completionRate,
      completedToday,
      completedThisWeek,
      workloadHours: +workloadHours.toFixed(1),
    },
    weeklyTrends,
    priorities: priorityCounts,
    upcomingDeadlines: upcomingDeadlines.slice(0, 6).map((t) => ({
      id: t.id,
      task: t.task,
      priority: t.priority,
      dueDate: t.dueDate,
    })),
    streaks,
    goals: evaluatedGoals,
    insights,
  };
}

module.exports = {
  calculateProductivityAnalytics,
  calculateStreaks,
  calculateWeeklyTrends,
  evaluateGoals,
  generateInsights,
  formatDateISO,
};
