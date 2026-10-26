/**
 * TaskFlow AI Intent Classifier & Domain Knowledge Router
 * Classifies user intent into distinct categories, extracts explicit constraints,
 * validates plans, and generates domain-specific, technically accurate responses.
 */

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 1. Intent Classification
 * Maps user queries into 10 structured intent categories.
 */
function classifyUserIntent(text) {
  const t = (text || "").trim();
  const lower = t.toLowerCase();

  // 1. Ambiguous or incomplete queries
  if (
    t.length < 8 ||
    /^(?:help|help me|do it|what|test|hello|hi|hey|why|pls|please help|what now|tell me|explain it|check this|any suggestions\??)$/i.test(t) ||
    /^(?:what should i do\??|how to do it\??|can you help\??|what do you think\??|tell me about it\??|(?:i\s+)?need\s+(?:some\s+)?(?:ideas|help|advice|suggestions)\??|(?:give\s+me\s+)?(?:ideas|advice|tips)\??)$/i.test(t)
  ) {
    return "ambiguous";
  }

  // 2. Task Breakdown requests
  if (/\b(?:break\s*down|subtasks?|decompose|split\s+into\s+steps|break\s+(?:[a-z0-9_\s-]+\s+)?into\s+(?:subtasks?|tasks?|steps|milestones?)|steps\s+to\s+complete)\b/i.test(lower)) {
    return "task_breakdown";
  }

  // 3. Scheduling and workload management
  if (/\b(?:reschedule|re-schedule|balance\s+(?:workload|schedule)|overdue\s+tasks?|workload\s+capacity|adjust\s+due\s+dates?|too\s+many\s+tasks\s+today|what\s+should\s+i\s+(?:do|work\s+on)\s+first|prioritize\s+(?:my\s+)?tasks?|what\s+to\s+do\s+first)\b/i.test(lower)) {
    return "scheduling";
  }

  // 4. Career and Interview Preparation
  if (/\b(?:interview|resume|portfolio|leetcode\s+prep|mock\s+interview|behavioral\s+questions?|hiring\s+manager|system\s+design\s+interview|coding\s+interview|job\s+offer|salary\s+negotiation)\b/i.test(lower)) {
    return "career_interview";
  }

  // 5. Exam Preparation
  if (/\b(?:exam|midterm|finals?\s+exam|test\s+(?:prep|in\s+\d+)|quiz\s+prep|gate\s+exam|gre\s+prep|ielts|toefl|sat\s+prep)\b/i.test(lower)) {
    return "exam_preparation";
  }

  // 6. Programming, Debugging & Code Assistance
  if (
    /\b(?:error|exception|debug|typeerror|syntaxerror|nullpointer|referenceerror|bug|stack\s*trace|recursion|recursive|pointers?|how\s+to\s+(?:write|code|implement|fix|resolve)|code\s+snippet|write\s+(?:an?\s+)?(?:algorithm|code|function|script|query|program)|algorithm\s+for|binary\s+search|write\s+(?:a\s+)?(?:python|javascript|typescript|c\+\+|cpp|java|rust|go|react|sql)\s+(?:code|function|script|algorithm|query)|(?:in|with|using)\s+(?:c\+\+|cpp|python|javascript|typescript|java|rust|golang|sql)|function\s+to|sql\s+query\s+for|api\s+endpoint|regex\s+for)\b/i.test(lower) ||
    /[{}[\]=>;]/.test(t)
  ) {
    return "programming_help";
  }

  // 7. Explicit Task Creation (via hashtag metadata #high/#low/#medium/#urgent, explicit "create task", or atomic errands)
  const isQuestion = /^(?:what|why|how|who|where|when|can|is|are|could|would)\b/i.test(lower) || t.endsWith("?");
  const hasTaskMetadata = /(?:#high|#low|#medium|#urgent)\b/i.test(lower);
  const explicitTaskPrefix = /^(?:create\s+(?:a\s+)?task|add\s+(?:a\s+)?task|i\s+want\s+to\s+create\s+a\s+task|new\s+task:?)\b/i.test(lower);
  const startsWithSimpleChore = /^(?:buy|call|email|send|pay|pickup|pick\s+up|order|book\s+(?:tickets?|flight|hotel|cab|uber|table)|deposit|refund|submit)\b/i.test(lower);

  if (explicitTaskPrefix || (hasTaskMetadata && !isQuestion) || startsWithSimpleChore) {
    return "task_creation";
  }

  // 8. Learning Roadmap & Study Plan
  if (
    /\b(?:study\s+plan|learning\s+roadmap|roadmap\s+(?:to|for)|curriculum|syllabus|how\s+to\s+learn|master\s+[a-z\s]+\s+in\s+\d+|self-study|learn\s+[a-z\s]+(?:from\s+scratch|grammar|development|basics?)|(?:i\s+)?want\s+to\s+learn|beginner\s+guide\s+to|course\s+outline)\b/i.test(lower) ||
    /\b(?:study|learn|revise|revision)\b/i.test(lower)
  ) {
    return "study_plan";
  }

  // 9. Project Planning, Daily Schedules, Routines & Multi-step Action Plans
  if (
    /\b(?:project\s+plan|plan\s+(?:an?\s+)?(?:[a-z0-9_-]+\s+)*(?:migration|platform|system|project|app|service)|mvp|architecture\s+design|deliverables?|milestones?\s+for|full\s*stack\s+project|scrum\s+sprint|product\s+roadmap)\b/i.test(lower) ||
    /\bbuild\s+(?:an?\s+)?(?:[a-z0-9_-]+\s+)*(?:app|website|system|platform|saas|tool|pipeline|service)\b/i.test(lower) ||
    /\b(?:schedule|timetable|time\s*table|routine|agenda|daily\s+plan|weekly\s+plan|daily\s+schedule|weekly\s+schedule)\b/i.test(lower) ||
    /\bplan\s+(?:my\s+)?(?:day|week|month|tomorrow|today|morning|evening|night|work|workout|routine)\b/i.test(lower) ||
    /\bplan\s+for\s+(?:today|tomorrow|this\s+week|next\s+week|\d+\s+days?)\b/i.test(lower) ||
    /\b(?:clean\s+(?:my\s+)?(?:room|house|apartment|desk|garage|closet|kitchen)|declutter|organize\s+(?:my\s+)?(?:room|desk|workspace|house))\b/i.test(lower) ||
    /\b(?:workout|gym|fitness\s+plan|exercise\s+schedule)\b/i.test(lower)
  ) {
    return "project_planning";
  }

  // 10. General Explanation & Conceptual Questions
  if (/^(?:what\s+is|what\s+are|why\s+is|why\s+do|why\s+should|how\s+does|explain|difference\s+between|pros\s+and\s+cons|define|meaning\s+of|overview\s+of)\b/i.test(lower)) {
    return "general_explanation";
  }

  // Default fallback:
  // If the user entered an action, goal, or schedule in the AI command centre ("Clean room", "Prepare slides", etc.),
  // generate a structured plan/schedule rather than creating a raw un-decomposed task!
  return isQuestion ? "general_explanation" : "project_planning";
}

/**
 * 2. User Constraint Extraction
 * Extracts deadlines, available hours, target days, and requested outcome.
 */
function extractUserConstraints(text, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const lower = (text || "").toLowerCase();

  // Days constraint
  let days = null;
  const inDaysMatch = lower.match(/\b(?:in|over|within|for)?\s*(\d+)\s+days?\b/i);
  const inWeeksMatch = lower.match(/\b(?:in|over|within|for)?\s*(\d+)\s+weeks?\b/i);
  if (inDaysMatch) {
    days = Math.max(1, Math.min(30, parseInt(inDaysMatch[1], 10)));
  } else if (inWeeksMatch) {
    days = Math.max(1, Math.min(30, parseInt(inWeeksMatch[1], 10) * 7));
  } else if (/\bnext\s+week\b/i.test(lower)) {
    days = 7;
  }

  // Hours per day constraint
  let dailyHours = null;
  const hoursMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:per\s+day|a\s+day|daily)?\b/i);
  if (hoursMatch) {
    dailyHours = Math.max(0.5, Math.min(16, parseFloat(hoursMatch[1])));
  }

  // Target date constraint
  let targetDate = null;
  if (days) {
    const d = new Date(ref);
    d.setDate(d.getDate() + days);
    targetDate = formatDateISO(d);
  } else if (/\btomorrow\b/i.test(lower)) {
    const d = new Date(ref);
    d.setDate(d.getDate() + 1);
    targetDate = formatDateISO(d);
    days = 1;
  } else if (/\btoday\b/i.test(lower)) {
    targetDate = formatDateISO(ref);
    days = 1;
  }

  // Skill level detection
  let skillLevel = "intermediate";
  if (/\b(?:beginner|from\s+scratch|basics?|starter|introductory|never\s+used|new\s+to)\b/i.test(lower)) {
    skillLevel = "beginner";
  } else if (/\b(?:advanced|expert|deep\s+dive|mastery|senior|complex|production-grade)\b/i.test(lower)) {
    skillLevel = "advanced";
  }

  return {
    days: days || 5,
    requestedDays: days,
    dailyHours: dailyHours || 3,
    targetDate,
    skillLevel,
    rawText: text,
  };
}

/**
 * 3. Plan Validation and Refinement
 * Ensures tasks have distinct purposes, realistic durations, respects daily budgets,
 * eliminates repetition, and removes generic template filler.
 */
function validateAndRefinePlan(rawPlan, goalText, constraints) {
  if (!rawPlan || typeof rawPlan !== "object") return null;

  const maxDailyMinutes = (constraints.dailyHours || 3) * 60;
  const cleanSubject = String(rawPlan.subject || goalText || "Preparation Plan").trim();
  const seenTaskTitles = new Set();
  const refinedSchedule = [];
  const refinedActionableTasks = [];

  const genericBannedPhrases = [
    "define scope",
    "scope definition",
    "initial execution",
    "wrap up",
    "final wrap-up",
    "quick wins",
    "clarify requirements",
    "assemble all required tools",
    "milestone execution",
  ];

  let rawSchedule = Array.isArray(rawPlan.schedule) ? rawPlan.schedule : [];

  // If rawSchedule is empty but actionableTasks is provided, group actionableTasks by day
  if (rawSchedule.length === 0 && Array.isArray(rawPlan.actionableTasks) && rawPlan.actionableTasks.length > 0) {
    const daysCount = constraints.requestedDays || constraints.days || rawPlan.days || 5;
    const daysMap = new Map();
    for (let d = 1; d <= daysCount; d++) {
      daysMap.set(d, []);
    }
    rawPlan.actionableTasks.forEach((task, idx) => {
      const dayNum = task.dayNumber || (idx % daysCount) + 1;
      const targetList = daysMap.get(dayNum) || daysMap.get(1);
      targetList.push({
        task: task.task || task.title,
        duration: typeof task.durationMinutes === "number" ? `${task.durationMinutes} mins` : (task.duration || "60 mins"),
        priority: task.priority || "Medium",
        phase: task.phase,
      });
    });

    rawSchedule = Array.from(daysMap.entries()).map(([dNum, items]) => ({
      dayNumber: dNum,
      dayLabel: `Day ${dNum}`,
      theme: `Day ${dNum}: ${cleanSubject}`,
      items,
    }));
  }

  rawSchedule.forEach((day, dayIdx) => {
    let dayTotalMinutes = 0;
    const validatedItems = [];

    const rawItems = Array.isArray(day.items) ? day.items : [];

    rawItems.forEach((item, itemIdx) => {
      let taskTitle = String(item.task || item.title || "").trim();
      if (!taskTitle) return;

      // Filter or replace generic template filler
      const isGeneric = genericBannedPhrases.some((phrase) =>
        taskTitle.toLowerCase().includes(phrase)
      );

      if (isGeneric) {
        taskTitle = `${cleanSubject}: Key Module Drill ${itemIdx + 1} (${day.theme || "Core Principles"})`;
      }

      // Ensure distinctness & eliminate duplicates
      const normalizedTitle = taskTitle.toLowerCase();
      if (seenTaskTitles.has(normalizedTitle)) {
        return; // Skip duplicate to give every task a distinct purpose
      }
      seenTaskTitles.add(normalizedTitle);

      // Parse and constrain duration
      let durationMinutes = 60;
      const durationStr = String(item.duration || "60 mins");
      const minsMatch = durationStr.match(/(\d+)/);
      if (minsMatch) {
        durationMinutes = parseInt(minsMatch[1], 10);
      }

      // Bound to daily limit and respect remaining capacity
      durationMinutes = Math.min(durationMinutes, maxDailyMinutes);
      if (dayTotalMinutes + durationMinutes > maxDailyMinutes && validatedItems.length >= 1) {
        durationMinutes = Math.max(30, maxDailyMinutes - dayTotalMinutes);
      }
      dayTotalMinutes += durationMinutes;

      const validatedItem = {
        id: item.id || `task-d${dayIdx + 1}-${itemIdx + 1}`,
        task: taskTitle,
        duration: `${durationMinutes} mins`,
        priority: item.priority || (itemIdx === 0 ? "High" : "Medium"),
        dueDate: item.dueDate || day.date,
        phase: item.phase || (dayIdx === 0 ? "Foundations" : dayIdx === rawSchedule.length - 1 ? "Review & Mock" : "Execution"),
        selected: true,
      };

      validatedItems.push(validatedItem);
      refinedActionableTasks.push(validatedItem);
    });

    refinedSchedule.push({
      dayNumber: day.dayNumber || dayIdx + 1,
      date: day.date,
      dayLabel: day.dayLabel || `Day ${dayIdx + 1}`,
      theme: day.theme || `Phase ${dayIdx + 1}: ${cleanSubject}`,
      items: validatedItems,
    });
  });

  return {
    goal: goalText,
    subject: cleanSubject,
    overview: rawPlan.overview || `A focused, progressive preparation plan tailored for "${cleanSubject}".`,
    days: refinedSchedule.length || constraints.days || rawPlan.days || 5,
    totalDays: refinedSchedule.length || constraints.days || rawPlan.days || 5,
    dailyHours: constraints.dailyHours || rawPlan.dailyHours || 3,
    totalHours: (refinedSchedule.length || constraints.days || 5) * (constraints.dailyHours || 3),
    totalSessions: refinedActionableTasks.length,
    schedule: refinedSchedule,
    recommendations: Array.isArray(rawPlan.recommendations) && rawPlan.recommendations.length > 0
      ? rawPlan.recommendations
      : [
          `Focus deep work blocks on high-weightage topics within ${cleanSubject}.`,
          "Employ active recall and problem tracing rather than passive reading.",
          "Solve authentic past questions under timed conditions before the deadline.",
        ],
    actionableTasks: refinedActionableTasks,
    provider: rawPlan.provider || "validated-intelligence-engine",
  };
}

/**
 * 4. Deterministic Domain Knowledge Answers
 * Used when offline or as high-precision domain baseline without fabricating facts.
 */
function generateDomainExplanation(query, intent, _constraints) {
  const lower = query.toLowerCase();

  // A. Database Systems (DBMS)
  if (/dbms|database|sql|index|acid|bcnf|normalization|transaction|sharding/i.test(lower)) {
    if (/index/i.test(lower)) {
      const ansText = `A database index is an auxiliary data structure (predominantly a **B+ Tree** in relational engines like PostgreSQL and MySQL, or a **Hash Table** in key-value caches) that allows the storage engine to locate rows without performing a sequential full table scan ($O(N)$ vs $O(\\log N)$ lookup).\n\n### How It Works:\n1. **B+ Tree Structure**: Leaf nodes store the indexed key along with row pointers (or clustered row data). Leaf nodes are linked in a bidirectional linked list, making range queries ($BETWEEN$, $>$, $<$) exceptionally fast.\n2. **Clustered vs Secondary Index**: A table can have only one clustered index (physical ordering of data, usually the PRIMARY KEY). Secondary indexes store pointers back to the clustered index key.\n3. **Write Overhead**: Every $INSERT$, $UPDATE$, or $DELETE$ requires rebalancing the tree and writing to WAL logs. Index only columns frequently present in $WHERE$, $JOIN$, and $ORDER BY$ clauses.`;
      return {
        title: "Database Indexing: Core Architecture & Performance",
        answer: ansText,
        explanation: ansText,
        examples: [
          "CREATE INDEX idx_users_email ON users(email);",
          "Compound index: CREATE INDEX idx_tasks_user_due ON tasks(userId, dueDate DESC);",
        ],
        keyTakeaways: [
          { point: "Time Complexity", detail: "O(log N) lookup vs O(N) full scan" },
          { point: "B+ Tree Structure", detail: "Balanced tree with linked leaf nodes for rapid range queries" },
          { point: "Write Cost", detail: "Index maintenance adds overhead to INSERT, UPDATE, and DELETE operations" },
        ],
        followUp: null,
      };
    }

    if (/acid|transaction/i.test(lower)) {
      const ansText = `ACID guarantees ensure that database transactions are processed reliably:\n\n1. **Atomicity (All-or-Nothing)**: Implemented via Write-Ahead Logging (WAL) or undo logs. If any statement fails, the entire transaction rolls back.\n2. **Consistency (Integrity Rules)**: Ensures state transitions preserve all schema constraints, foreign keys, and unique checks.\n3. **Isolation (Concurrent Safety)**: Prevents dirty reads, non-repeatable reads, and phantom reads using MVCC (Multi-Version Concurrency Control) or 2-Phase Locking (2PL).\n4. **Durability (Persistent Survival)**: Once a transaction commits, its modifications survive crashes, powered by synchronous disk flushes (fsync) to WAL.`;
      return {
        title: "ACID Guarantees in Relational Database Transactions",
        answer: ansText,
        explanation: ansText,
        examples: [
          "BEGIN TRANSACTION;\nUPDATE accounts SET balance = balance - 100 WHERE id = 1;\nUPDATE accounts SET balance = balance + 100 WHERE id = 2;\nCOMMIT;",
        ],
        keyTakeaways: [
          { point: "Atomicity", detail: "All-or-nothing rollback mechanism" },
          { point: "Isolation Levels", detail: "Read Committed vs Repeatable Read vs Serializable" },
          { point: "Durability", detail: "fsync writes to WAL ensure crash resilience" },
        ],
        followUp: null,
      };
    }
  }

  // B. Programming & Debugging
  if (intent === "programming_help") {
    if (/typeerror.*(?:undefined|null)|cannot read propert/i.test(lower)) {
      const codeStr = `// 1. Safe array mapping with optional chaining (?.) & fallback\nconst items = data?.items ?? [];\nconst rendered = data?.items?.map(item => <ItemCard key={item.id} data={item} />);\n\n// 2. Safe property access with optional chaining\nconst userName = user?.profile?.name || "Anonymous";`;
      const explStr = `This error occurs when JavaScript evaluates an expression like \`object.property\` or \`array.map()\` before asynchronous data fetching completes or when an API returned null/empty.\n\n### Root Causes & Fixes:\n1. **Optional Chaining (\`?.\`)**: Safely short-circuits to \`undefined\` instead of throwing a fatal runtime TypeError.\n2. **Nullish Coalescing (\`??\` or \`||\`)**: Provide a safe fallback array or default value.\n3. **Conditional Rendering Guard**: Check whether data is loaded before rendering child components.`;
      return {
        title: "Resolving 'TypeError: Cannot read properties of undefined'",
        problemSummary: "Attempted property access or method invocation on a null or undefined reference.",
        explanation: explStr,
        answer: explStr,
        codeSnippet: codeStr,
        codeExample: {
          language: "javascript",
          code: codeStr,
        },
        language: "javascript",
        testingSteps: [
          "Simulate an empty or loading state in your test to verify no unhandled exception is thrown.",
          "Check browser Network tab to verify response structure matches expected keys.",
        ],
      };
    }

    if (/reverse.*linked\s*list/i.test(lower)) {
      const codeStr = `class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef reverseList(head: ListNode) -> ListNode:\n    prev = None\n    curr = head\n    while curr:\n        next_temp = curr.next  # Save next node\n        curr.next = prev       # Reverse pointer\n        prev = curr            # Move prev forward\n        curr = next_temp       # Move curr forward\n    return prev`;
      const explStr = `To reverse a linked list iteratively, maintain three pointers: \`prev\`, \`curr\`, and \`next\`. Traverse the list once, redirecting each node's pointer backward without allocating new memory nodes.`;
      return {
        title: "Reversing a Singly Linked List (Iterative & Optimal)",
        problemSummary: "Reverse pointer directions in $O(N)$ time and $O(1)$ auxiliary space.",
        explanation: explStr,
        answer: explStr,
        codeSnippet: codeStr,
        codeExample: {
          language: "python",
          code: codeStr,
        },
        language: "python",
        testingSteps: [
          "Edge Case 1: Empty list (head is None) -> returns None.",
          "Edge Case 2: Single node -> returns the same node.",
          "Standard Case: [1, 2, 3, 4, 5] -> returns [5, 4, 3, 2, 1].",
        ],
      };
    }
  }

  // C. Career & Interview Preparation
  if (intent === "career_interview") {
    return {
      title: "Targeted Software Engineering Interview Preparation Strategy",
      answer: `To prepare effectively for top software engineering interviews, structure your preparation across three essential pillars:\n\n1. **Data Structures & Algorithms (DSA) Core Patterns (50% of Time)**:\n   - Focus on patterns, not memorizing problem numbers: Two Pointers, Sliding Window, Monotonic Stack, BFS/DFS, Binary Search, and 1D/2D Dynamic Programming.\n   - Practice under timed conditions on LeetCode Mediums (target 25-30 minutes per problem).\n\n2. **System Design & Architecture (30% of Time)**:\n   - Practice standard architectures: Rate Limiter, URL Shortener, Chat System, Video Streaming (YouTube/Netflix).\n   - Master trade-offs: SQL vs NoSQL, Caching (Redis), Load Balancing (Nginx/HAProxy), Message Queues (Kafka/RabbitMQ), and CAP theorem.\n\n3. **Behavioral & Leadership Stories (20% of Time)**:\n   - Prepare 4-5 STAR stories (Situation, Task, Action, Result) covering technical conflict, leading a project, handling an outage, and receiving constructive feedback.`,
      examples: [
        "Week 1: Arrays, Hash Maps, Sliding Window & String manipulation",
        "Week 2: Linked Lists, Trees, Graph Traversals & Recursion",
        "Week 3: Dynamic Programming, System Design deep-dives & 2 timed mock interviews",
      ],
      followUp: "What specific company or target level (e.g. Junior, Senior, Staff) are you targeting?",
    };
  }

  // D. General Conceptual fallback
  return {
    title: `Understanding ${query.replace(/[?.]+$/, "")}`,
    answer: `Here is a clear, structured breakdown of your question:\n\n- **Core Definition**: ${query} involves understanding the underlying architecture, key trade-offs, and practical execution.\n- **Key Principles**: Identify requirements, isolate variables, verify prerequisites, and evaluate performance or outcome.\n- **Practical Application**: Approach the problem iteratively by establishing a solid baseline before optimizing edge cases.`,
    examples: [],
    followUp: null,
  };
}

module.exports = {
  classifyUserIntent,
  extractUserConstraints,
  validateAndRefinePlan,
  generateDomainExplanation,
};
