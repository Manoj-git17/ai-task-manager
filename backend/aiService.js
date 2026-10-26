const {
  classifyUserIntent,
  extractUserConstraints,
  validateAndRefinePlan,
  generateDomainExplanation,
} = require("./aiIntentRouter");
const {
  isGeminiConfigured,
  callGemini,
  generatePlanWithGemini,
  breakdownTaskWithGemini,
} = require("./geminiClient");
/**
 * TaskFlow AI Task Intelligence Service
 * Provides natural language parsing and tactical subtask decomposition.
 * Prioritizes zero-dependency, local-first intelligence with seamless optional LLM fallback.
 */

const dayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Natural language task parsing
 * Extracts task title, priority, and due date from unstructured text.
 */
function parseNaturalLanguageTask(text, referenceDate = new Date()) {
  if (!text || typeof text !== "string") {
    return { task: "", priority: "Medium", dueDate: null, summary: "" };
  }

  let cleaned = text.trim();
  let detectedPriority = "Medium";
  let detectedDate = null;
  const extractedFeatures = [];

  // 1. Priority Detection
  const highPriorityRegex =
    /(?:#high|#urgent|\b(?:priority:\s*high|high\s+priority|p1|urgent|urgently|critical|asap)\b)/i;
  const lowPriorityRegex =
    /(?:#low|\b(?:priority:\s*low|low\s+priority|p3|minor|low-priority)\b)/i;
  const medPriorityRegex =
    /(?:#medium|\b(?:priority:\s*medium|medium\s+priority|p2|normal)\b)/i;

  if (highPriorityRegex.test(cleaned)) {
    detectedPriority = "High";
    extractedFeatures.push("High Priority");
    cleaned = cleaned.replace(highPriorityRegex, " ");
  } else if (lowPriorityRegex.test(cleaned)) {
    detectedPriority = "Low";
    extractedFeatures.push("Low Priority");
    cleaned = cleaned.replace(lowPriorityRegex, " ");
  } else if (medPriorityRegex.test(cleaned)) {
    detectedPriority = "Medium";
    extractedFeatures.push("Medium Priority");
    cleaned = cleaned.replace(medPriorityRegex, " ");
  }

  // 2. Relative Date Patterns
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const dayAfterTomorrowRegex = /\b(?:the\s+)?day\s+after\s+tomorrow\b/i;
  const tomorrowRegex = /\btomorrow\b/i;
  const todayRegex = /\b(?:today|tonight)\b/i;
  const inDaysRegex = /\bin\s+(\d+)\s+days?\b/i;
  const inWeeksRegex = /\bin\s+(\d+)\s+weeks?\b/i;
  const weekdayRegex =
    /\b(?:by|on|this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const isoDateRegex = /\b(\d{4})-(\d{2})-(\d{2})\b/;

  if (dayAfterTomorrowRegex.test(cleaned)) {
    const target = new Date(today);
    target.setDate(target.getDate() + 2);
    detectedDate = formatDateISO(target);
    extractedFeatures.push(`Due ${detectedDate} (Day after tomorrow)`);
    cleaned = cleaned.replace(dayAfterTomorrowRegex, " ");
  } else if (tomorrowRegex.test(cleaned)) {
    const target = new Date(today);
    target.setDate(target.getDate() + 1);
    detectedDate = formatDateISO(target);
    extractedFeatures.push(`Due ${detectedDate} (Tomorrow)`);
    cleaned = cleaned.replace(tomorrowRegex, " ");
  } else if (todayRegex.test(cleaned)) {
    detectedDate = formatDateISO(today);
    extractedFeatures.push(`Due ${detectedDate} (Today)`);
    cleaned = cleaned.replace(todayRegex, " ");
  } else if (inDaysRegex.test(cleaned)) {
    const match = cleaned.match(inDaysRegex);
    const days = parseInt(match[1], 10);
    const target = new Date(today);
    target.setDate(target.getDate() + days);
    detectedDate = formatDateISO(target);
    extractedFeatures.push(`Due in ${days} days (${detectedDate})`);
    cleaned = cleaned.replace(inDaysRegex, " ");
  } else if (inWeeksRegex.test(cleaned)) {
    const match = cleaned.match(inWeeksRegex);
    const weeks = parseInt(match[1], 10);
    const target = new Date(today);
    target.setDate(target.getDate() + weeks * 7);
    detectedDate = formatDateISO(target);
    extractedFeatures.push(`Due in ${weeks} weeks (${detectedDate})`);
    cleaned = cleaned.replace(inWeeksRegex, " ");
  } else if (isoDateRegex.test(cleaned)) {
    const match = cleaned.match(isoDateRegex);
    detectedDate = `${match[1]}-${match[2]}-${match[3]}`;
    extractedFeatures.push(`Due ${detectedDate}`);
    cleaned = cleaned.replace(isoDateRegex, " ");
  } else if (weekdayRegex.test(cleaned)) {
    const match = cleaned.match(weekdayRegex);
    const targetDayName = match[1].toLowerCase();
    const targetDayIndex = dayNames.indexOf(targetDayName);
    if (targetDayIndex !== -1) {
      const currentDayIndex = today.getDay();
      let diff = targetDayIndex - currentDayIndex;
      if (diff <= 0) diff += 7; // next occurrence
      const target = new Date(today);
      target.setDate(target.getDate() + diff);
      detectedDate = formatDateISO(target);
      extractedFeatures.push(
        `Due ${targetDayName.charAt(0).toUpperCase() + targetDayName.slice(1)} (${detectedDate})`
      );
      cleaned = cleaned.replace(weekdayRegex, " ");
    }
  }

  // Remove leading/trailing connectors
  cleaned = cleaned
    .replace(/\b(?:by|due|on|before|at|for)\s*$/i, "")
    .replace(/^\s*(?:by|due|on|before|at|for)\s*/i, "")
    .replace(/[#@]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    cleaned = text.trim();
  }

  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return {
    task: cleaned,
    priority: detectedPriority,
    dueDate: detectedDate,
    summary:
      extractedFeatures.length > 0
        ? `Identified: ${extractedFeatures.join(", ")}`
        : "Standard priority assigned",
    provider: "local-nlp",
  };
}

/**
 * Task decomposition / subtask generator
 * Deconstructs high-level tasks into actionable subtasks.
 */
function breakdownTaskIntoSubtasks(
  taskTitle,
  parentPriority = "Medium",
  parentDueDate = null,
  referenceDate = new Date()
) {
  const title = (taskTitle || "").trim();
  const lower = title.toLowerCase();

  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  function offsetDate(days) {
    const d = new Date(ref);
    d.setDate(d.getDate() + days);
    return formatDateISO(d);
  }

  let subtasks;

  // 1. Study & Learning
  if (/study|learn|exam|course|tutorial|practice|interview|read\s+book/i.test(lower)) {
    subtasks = [
      {
        task: `Review syllabus & core concepts for ${title}`,
        priority: "High",
        dueDate: offsetDate(1),
      },
      {
        task: `Work through practical exercises & examples`,
        priority: parentPriority,
        dueDate: offsetDate(2),
      },
      {
        task: `Synthesize quick reference summary notes`,
        priority: "Medium",
        dueDate: offsetDate(3),
      },
      {
        task: `Conduct self-assessment / mock practice`,
        priority: parentPriority,
        dueDate: parentDueDate || offsetDate(4),
      },
    ];
  }
  // 2. Software & Tech Development
  else if (
    /auth|api|backend|frontend|database|deploy|test|bug|feature|app|react|node|python|dsa|code|server|endpoint|refactor/i.test(
      lower
    )
  ) {
    subtasks = [
      {
        task: `Define architecture & requirements for ${title}`,
        priority: parentPriority,
        dueDate: offsetDate(1),
      },
      {
        task: `Implement core logic and error handling`,
        priority: parentPriority,
        dueDate: offsetDate(2),
      },
      {
        task: `Write unit and integration tests`,
        priority: "Medium",
        dueDate: offsetDate(3),
      },
      {
        task: `Code review and deployment verification`,
        priority: "Low",
        dueDate: parentDueDate || offsetDate(4),
      },
    ];
  }
  // 3. Marketing & Business Launch
  else if (
    /market|campaign|launch|sales|client|pitch|proposal|pricing|product/i.test(
      lower
    )
  ) {
    subtasks = [
      {
        task: `Define target audience & value proposition for ${title}`,
        priority: "High",
        dueDate: offsetDate(1),
      },
      {
        task: `Prepare promotional creative & messaging`,
        priority: parentPriority,
        dueDate: offsetDate(2),
      },
      {
        task: `Establish success metrics and distribution channels`,
        priority: "Medium",
        dueDate: offsetDate(3),
      },
      {
        task: `Execute launch and monitor initial metrics`,
        priority: parentPriority,
        dueDate: parentDueDate || offsetDate(5),
      },
    ];
  }
  // 4. Writing & Documentation
  else if (
    /write|blog|article|doc|documentation|readme|paper|report|guide/i.test(
      lower
    )
  ) {
    subtasks = [
      {
        task: `Outline structure & key points for ${title}`,
        priority: "Medium",
        dueDate: offsetDate(1),
      },
      {
        task: `Draft initial content and code snippets`,
        priority: parentPriority,
        dueDate: offsetDate(2),
      },
      {
        task: `Review, edit, and format layout`,
        priority: "Medium",
        dueDate: offsetDate(3),
      },
      {
        task: `Publish and share with audience`,
        priority: "Low",
        dueDate: parentDueDate || offsetDate(4),
      },
    ];
  }
  // 5. Design & User Experience
  else if (
    /design|ui|ux|figma|wireframe|prototype|mockup|brand|logo/i.test(lower)
  ) {
    subtasks = [
      {
        task: `Gather references and user requirements for ${title}`,
        priority: "Medium",
        dueDate: offsetDate(1),
      },
      {
        task: `Create low-fidelity wireframes`,
        priority: parentPriority,
        dueDate: offsetDate(2),
      },
      {
        task: `Build interactive prototype in Figma`,
        priority: parentPriority,
        dueDate: offsetDate(3),
      },
      {
        task: `Validate design with stakeholders`,
        priority: "Low",
        dueDate: parentDueDate || offsetDate(4),
      },
    ];
  }
  // 6. General Progressive Milestone Default
  else {
    subtasks = [
      {
        task: `Clarify goals and prerequisites for ${title}`,
        priority: "High",
        dueDate: offsetDate(1),
      },
      {
        task: `Execute initial action items`,
        priority: parentPriority,
        dueDate: offsetDate(2),
      },
      {
        task: `Evaluate progress and remove bottlenecks`,
        priority: "Medium",
        dueDate: offsetDate(3),
      },
      {
        task: `Finalize and verify successful completion of ${title}`,
        priority: "Low",
        dueDate: parentDueDate || offsetDate(4),
      },
    ];
  }

  return {
    parentTask: title,
    subtasks,
    provider: "local-heuristic",
  };
}

/**
 * Domain-specific progressive learning & execution curricula
 */
function getDomainCurriculum(subject, lowerText) {
  if (
    /dbms|database|sql|postgres|mongo|mysql|rdbms/i.test(lowerText) ||
    /dbms|database|sql/i.test(subject)
  ) {
    return [
      {
        theme: "ER Modeling & Relational Foundations",
        session1: "Master Entity Sets, Relationships, Keys & Relational Schema Design",
        session2: "Practice Relational Algebra Operations, Joins & Integrity Constraints",
      },
      {
        theme: "SQL Query Mastery & Complex Queries",
        session1: "Advanced SQL: Inner/Outer Joins, Aggregations & Group By Clauses",
        session2: "Nested Subqueries, Correlated Queries & Views Construction",
      },
      {
        theme: "Schema Design & Normalization Theory",
        session1: "Functional Dependencies, Closure Sets & Normal Forms (1NF, 2NF, 3NF)",
        session2: "BCNF Decomposition, Lossless Joins & Dependency Preservation Drills",
      },
      {
        theme: "Transactions, Concurrency & Indexing",
        session1: "ACID Guarantees, Serializability & Lock-Based Concurrency Protocols",
        session2: "B+ Tree Index Structures, Hashing Techniques & Query Optimization",
      },
      {
        theme: "Past Papers, High-Yield Drills & Mock Exam",
        session1: "Solve High-Frequency Previous Year Exam Questions & Case Scenarios",
        session2: "Timed Full Mock Exam Simulation & Weak-Area Rapid Remediation",
      },
      {
        theme: "Advanced Storage & Distributed Database Concepts",
        session1: "CAP Theorem, Sharding, Replication & Document-Oriented Stores",
        session2: "Performance Tuning, Connection Pooling & Security Best Practices",
      },
      {
        theme: "Final Comprehensive Revision",
        session1: "Rapid Formula & Relational Architecture Flashcard Recall",
        session2: "Final Assessment & Confidence Check",
      },
    ];
  }

  if (
    /dsa|algorithm|leetcode|data structure|coding/i.test(lowerText) ||
    /dsa|algo/i.test(subject)
  ) {
    return [
      {
        theme: "Arrays & Sliding Window Patterns",
        session1: "Master Two Pointers, Prefix Sums & Sliding Window Problem Patterns",
        session2: "Solve 4 Medium Array Problems & Analyze Time/Space Complexity",
      },
      {
        theme: "Hashing, Stacks & Queue Mechanics",
        session1: "Monotonic Stacks, Queue Implementations & Fast Hash Map Lookups",
        session2: "Solve Parentheses Matching & Frequency Counting Practice Problems",
      },
      {
        theme: "Trees, Binary Search Trees & Recursion",
        session1: "Binary Tree Traversals (Inorder, Preorder, Level-Order Mechanics)",
        session2: "BST Validation, Lowest Common Ancestor & Tree Problem Drills",
      },
      {
        theme: "Graph Algorithms & Traversal",
        session1: "BFS/DFS Implementations, Connected Components & Cycle Detection",
        session2: "Topological Sort & Dijkstra Shortest Path Practice Drills",
      },
      {
        theme: "Dynamic Programming Foundations",
        session1: "1D DP Patterns: Fibonacci Sequences, Knapsack & Subsequence Problems",
        session2: "2D Grid DP & State Transition Space Optimization",
      },
      {
        theme: "Heaps & Greedy Strategies",
        session1: "Min/Max Heaps, Top-K Frequent Elements & Stream Median Finding",
        session2: "Interval Scheduling, Merge Intervals & Greedy Proof Applications",
      },
      {
        theme: "Timed Technical Simulation",
        session1: "Simulated 90-minute Technical Coding Assessment",
        session2: "Post-Mock Code Review & Big-O Optimization",
      },
    ];
  }

  if (
    /react|frontend|web|javascript|typescript|ui|css|html/i.test(lowerText) ||
    /react|frontend/i.test(subject)
  ) {
    return [
      {
        theme: "Component Architecture & State Mechanics",
        session1: "Design Component Hierarchy, Props Contracts & Local State Mechanics",
        session2: "Implement Interactive UI Components with Controlled Form Inputs",
      },
      {
        theme: "Modern React Hooks Mastery",
        session1: "Master useEffect Side Effects, Cleanup Lifecycles & Dependencies",
        session2: "Optimize Renders with useMemo, useCallback & Custom Reusable Hooks",
      },
      {
        theme: "Routing & Application Layouts",
        session1: "Configure Dynamic Routing, Nested Routes & Protected Views",
        session2: "Build Responsive Topbar, Sidebar Navigation & Breadcrumbs",
      },
      {
        theme: "API Integration & Async State",
        session1: "Connect REST Endpoints with Resilient Fetch & Error States",
        session2: "Implement Optimistic UI Updates & Loading Indicators",
      },
      {
        theme: "State Management & Form Validation",
        session1: "Centralized State Architecture & Context/Reducer Patterns",
        session2: "Form Validation, Error Banners & Toast Feedback Handling",
      },
      {
        theme: "Styling Tokens, Themes & Polish",
        session1: "Design Tokens, Fluid Typography & Theme Switching System",
        session2: "Accessibility (a11y) Keyboard Navigation & Contrast Checks",
      },
      {
        theme: "Production Build & Optimization",
        session1: "Vite Production Build Profiling & Bundle Size Optimization",
        session2: "End-to-End User Journey Verification & Deployment",
      },
    ];
  }

  if (
    !/java|python/i.test(lowerText) &&
    (/\b(?:backend|node|express|api|django|fastapi|server)\b/i.test(lowerText) ||
      /backend|api|server/i.test(subject))
  ) {
    return [
      {
        theme: "Server Architecture & REST Design",
        session1: "Express Server Setup, Route Modularization & Controller Separation",
        session2: "Define RESTful CRUD Endpoints & Request Body Validation",
      },
      {
        theme: "Database Integration & Schema Design",
        session1: "Database Schema Migrations & Connection Pooling Configuration",
        session2: "Write Parameterized SQL Queries & Data Normalization Logic",
      },
      {
        theme: "Authentication & Security Architecture",
        session1: "Implement JWT Token Generation, Verification & Expiry Rules",
        session2: "Password Hashing (bcrypt) & Auth Guard Middleware Enforcement",
      },
      {
        theme: "Validation & Centralized Error Handling",
        session1: "Input Sanitization, Schema Validation & Guard Clauses",
        session2: "Global Error Handling Middleware & Structured Logging Pipeline",
      },
      {
        theme: "Automated Testing & API Contract Verification",
        session1: "Write Automated Unit Tests for Services & Middleware",
        session2: "Write Integration Tests for Critical API Endpoints",
      },
      {
        theme: "Production Readiness & Deployment",
        session1: "Environment Security, CORS Hardening & Rate Limiting",
        session2: "Containerization / Process Daemon Setup & Live Health Verification",
      },
    ];
  }

  // 5. Operating Systems (OS)
  if (
    /operating system|\bos\b|kernel|paging|deadlock|concurrency|semaphores?|cpu scheduling/i.test(lowerText) ||
    /\bos\b|operating system/i.test(subject)
  ) {
    return [
      {
        theme: "Processes, Threads & CPU Scheduling",
        session1: "Master Process Lifecycle, Context Switching, Fork/Exec & Threading Models",
        session2: "Solve FCFS, SJF, Round Robin & Priority Scheduling Numerical Problems",
      },
      {
        theme: "Process Synchronization & Mutex Mechanics",
        session1: "Critical Section Problem, Peterson's Algorithm, Mutex Locks & Semaphores",
        session2: "Classic Synchronization: Producer-Consumer, Readers-Writers & Dining Philosophers",
      },
      {
        theme: "Deadlock Detection, Prevention & Avoidance",
        session1: "Deadlock Necessary Conditions, Resource Allocation Graphs & Prevention",
        session2: "Execute Banker's Safety & Resource-Request Algorithm Step-by-Step",
      },
      {
        theme: "Memory Management & Paging Systems",
        session1: "Contiguous Allocation, Logical vs Physical Addresses, Paging & Segmentation",
        session2: "Page Replacement Algorithms: FIFO, LRU, Optimal & Belady's Anomaly Drills",
      },
      {
        theme: "Virtual Memory, Inodes & Disk Scheduling",
        session1: "Demand Paging, Page Fault Handling, Thrashing & Working Set Model",
        session2: "File Systems (Inodes), Directory Structures & Disk Scheduling (SCAN, C-LOOK)",
      },
      {
        theme: "Timed Mock Exam & Comprehensive Revision",
        session1: "Solve High-Frequency Previous Year OS Exam Questions & Numerical Drills",
        session2: "Full Timed OS Exam Simulation & Rapid Conceptual Formula Recall",
      },
    ];
  }

  // 6. Computer Networks (CN)
  if (
    /computer network|networking|\bcn\b|tcp|ip|osi|routing|subnetting|dns|http/i.test(lowerText) ||
    /\bcn\b|computer network/i.test(subject)
  ) {
    return [
      {
        theme: "Layered Architectures & Data Link Mechanics",
        session1: "OSI 7-Layer vs TCP/IP Model Protocol Mappings, Encapsulation & Functions",
        session2: "Framing, Error Detection (CRC, Checksum, Parity) & Sliding Window Protocols",
      },
      {
        theme: "IP Addressing, CIDR & Subnetting Drills",
        session1: "IPv4 vs IPv6 Structure, Classful vs Classless Addressing & CIDR Notation",
        session2: "Hands-on Subnetting Drills: Subnet Masks, Network/Broadcast IDs & Host Allocations",
      },
      {
        theme: "Network Routing & Forwarding Protocols",
        session1: "Router Architecture, Distance Vector (Bellman-Ford) & Count-to-Infinity",
        session2: "Link State Routing (Dijkstra/OSPF), BGP Basics & NAT/DHCP Packet Flow",
      },
      {
        theme: "Transport Layer: TCP vs UDP Mechanics",
        session1: "TCP 3-Way Handshake, Connection Teardown & Segment Header Architecture",
        session2: "TCP Flow Control (Sliding Window) & Congestion Control (Slow Start, AIMD)",
      },
      {
        theme: "Application Layer & Network Security",
        session1: "DNS Resolution Flow, HTTP/1.1 vs HTTP/2/3, Cookies & WebSocket Protocols",
        session2: "Network Security: Symmetric/Asymmetric Keys, TLS/SSL Handshake & Firewalls",
      },
      {
        theme: "Timed Network Simulation & Final Drill",
        session1: "Solve High-Yield Numerical Problems (Bandwidth-Delay, CRC, Subnetting)",
        session2: "Comprehensive Timed CN Mock Exam & Weak-Area Rapid Remediation",
      },
    ];
  }

  // 7. System Design & Scalability
  if (
    /system design|scalability|high availability|microservices|distributed systems/i.test(lowerText) ||
    /system design|scalability/i.test(subject)
  ) {
    return [
      {
        theme: "Requirements & Capacity Estimations",
        session1: "Deconstruct Functional/Non-Functional Specs, SLA/SLO & Latency Budgets",
        session2: "Back-of-the-Envelope Calculations: QPS, Bandwidth, Storage & Memory Needs",
      },
      {
        theme: "Load Balancing, API Gateways & Caching",
        session1: "Layer 4 vs Layer 7 Load Balancing Algorithms & Reverse Proxies (Nginx)",
        session2: "Distributed Caching (Redis/Memcached): Cache-Aside, Write-Through & Eviction",
      },
      {
        theme: "Database Scaling, Sharding & CAP Theorem",
        session1: "RDBMS vs NoSQL Tradeoffs, Read Replicas & Database Sharding Strategies",
        session2: "CAP Theorem, PACELC, Strong vs Eventual Consistency & Two-Phase Commit",
      },
      {
        theme: "Asynchronous Systems & Message Brokers",
        session1: "Event-Driven Architecture: Message Queues (RabbitMQ) vs Event Streams (Kafka)",
        session2: "Idempotent Consumers, Dead Letter Queues & Distributed Task Workers",
      },
      {
        theme: "Reliability, Resiliency & Microservices",
        session1: "Circuit Breakers, Exponential Backoff, Rate Limiting & Bulkhead Patterns",
        session2: "Distributed Tracing, Structured Logging, Health Checks & Observability",
      },
      {
        theme: "Mock Architectural Design Interview",
        session1: "Design a Real-World System (e.g., URL Shortener, Twitter Feed, Rate Limiter)",
        session2: "Review Architecture Bottlenecks, Single Points of Failure (SPOF) & Defense",
      },
    ];
  }

  // 8. Machine Learning, AI & Data Science
  if (
    /machine learning|\bml\b|\bai\b|data science|deep learning|neural network|nlp|artificial intelligence/i.test(lowerText) ||
    /\bml\b|\bai\b|machine learning/i.test(subject)
  ) {
    return [
      {
        theme: "Mathematical Foundations & Exploratory Data Analysis",
        session1: "Linear Algebra (Vectors, Matrices, Eigenvalues) & Multivariate Calculus",
        session2: "Data Cleaning, Imputation, One-Hot Encoding & Outlier Handling with Pandas",
      },
      {
        theme: "Supervised Learning: Regression & Classification",
        session1: "Linear/Polynomial Regression, Cost Functions & Gradient Descent Optimization",
        session2: "Logistic Regression, Decision Trees, Information Gain & Support Vector Machines",
      },
      {
        theme: "Ensemble Methods & Unsupervised Clustering",
        session1: "Random Forests, Bagging vs Boosting (AdaBoost, Gradient Boosting, XGBoost)",
        session2: "K-Means Clustering, Hierarchical Clustering & PCA Dimensionality Reduction",
      },
      {
        theme: "Model Evaluation & Hyperparameter Optimization",
        session1: "Confusion Matrix, Precision/Recall, F1-Score, ROC-AUC & Bias-Variance Tradeoff",
        session2: "K-Fold Cross-Validation, Regularization (L1/L2) & Grid/RandomizedSearchCV",
      },
      {
        theme: "Deep Learning Foundations & Neural Networks",
        session1: "Perceptrons, Multi-Layer Perceptrons, Activation Functions & Backpropagation",
        session2: "CNNs for Spatial Patterns & RNNs/Transformers for Sequential Data Basics",
      },
      {
        theme: "Mock Assessment & Real-World Capstone Pipeline",
        session1: "Build & Deploy an End-to-End Scikit-Learn Inference Pipeline",
        session2: "Comprehensive ML Concept Assessment & Weak-Area Rapid Tuning",
      },
    ];
  }

  // 9. Python Programming
  if (
    /python/i.test(lowerText) ||
    /python/i.test(subject)
  ) {
    return [
      {
        theme: "Core Constructs, Memory Model & Collections",
        session1: "Primitive Types, Mutability, Memory References, Lists, Tuples, Dicts & Sets",
        session2: "List/Dict Comprehensions, Slicing Patterns & Generator Expressions",
      },
      {
        theme: "Advanced Idioms: Functions, Decorators & Iterators",
        session1: "*args, **kwargs, First-Class Functions, Closures & Custom Decorators",
        session2: "Iterators, Generators (yield), itertools & Built-in Functional Utilities",
      },
      {
        theme: "Object-Oriented Architecture & Dunder Methods",
        session1: "Classes, Self, __init__, Inheritance, Method Resolution Order (MRO) & Mixins",
        session2: "Dunder Protocol Methods (__repr__, __str__, __len__, __iter__, __getitem__)",
      },
      {
        theme: "Error Handling, Context Managers & File Systems",
        session1: "Custom Exceptions, try-except-else-finally & Defensive Code Practices",
        session2: "Context Managers (with statement, contextlib), pathlib & File Processing",
      },
      {
        theme: "Modern Tooling, Testing & Ecosystem",
        session1: "Virtual Environments, pip/poetry, Type Hinting (mypy) & Unit Testing (pytest)",
        session2: "Concurrency Fundamentals: Threading vs Multiprocessing vs asyncio Event Loops",
      },
      {
        theme: "Production Project Script & Code Review",
        session1: "Implement an End-to-End Modular Python Utility / Application",
        session2: "Code Profiling, Complexity Optimization & Best Practices (PEP 8)",
      },
    ];
  }

  // 10. Java & Object-Oriented Architecture
  if (
    /java|\boop\b|spring boot|jvm/i.test(lowerText) ||
    /java/i.test(subject)
  ) {
    return [
      {
        theme: "Java Core Foundations & JVM Memory Model",
        session1: "Primitive vs Reference Types, Stack vs Heap Memory & Garbage Collection (GC)",
        session2: "Control Structures, Method Overloading, Static vs Instance Contexts",
      },
      {
        theme: "Four Pillars of Object-Oriented Programming",
        session1: "Encapsulation, Data Hiding, Inheritance, Super Keyword & Polymorphism",
        session2: "Abstraction: Abstract Classes vs Interfaces & Default/Static Interface Methods",
      },
      {
        theme: "Java Collections Framework & Data Structures",
        session1: "List (ArrayList, LinkedList), Set (HashSet, TreeSet) & Map (HashMap, TreeMap)",
        session2: "Internal Mechanics of HashMap, equals() & hashCode() Contracts & Iterators",
      },
      {
        theme: "Generics, Exceptions & Modern Streams API",
        session1: "Generic Classes/Methods, Wildcards (<? extends T>) & Checked/Unchecked Errors",
        session2: "Lambda Expressions, Functional Interfaces & Streams API (map, filter, collect)",
      },
      {
        theme: "Multithreading & Enterprise Design Patterns",
        session1: "Thread Lifecycle, Runnable vs Callable, Synchronized Blocks & ExecutorService",
        session2: "Core GoF Design Patterns: Singleton, Factory, Builder, Strategy & Observer",
      },
      {
        theme: "Mock Technical Assessment & Practical Drills",
        session1: "Solve High-Frequency Java Technical Interview & Exam Coding Drills",
        session2: "Review Common Java Pitfalls, Memory Leak Scenarios & Mock Quiz",
      },
    ];
  }

  // 11. DevOps, Cloud & CI/CD
  if (
    /devops|docker|kubernetes|\bk8s\b|ci\/?cd|aws|cloud infrastructure/i.test(lowerText) ||
    /devops|docker|kubernetes/i.test(subject)
  ) {
    return [
      {
        theme: "Linux Administration & Version Control",
        session1: "Shell Navigation, Permissions (chmod/chown), Systemd & Networking Commands",
        session2: "Advanced Git Workflows: Rebasing, Merge Conflicts, Hooks & Branching Models",
      },
      {
        theme: "Containerization with Docker",
        session1: "Docker Architecture, Images vs Containers, Multi-Stage Dockerfile Optimization",
        session2: "Docker Networking, Persistent Volumes & Multi-Container Docker Compose",
      },
      {
        theme: "Container Orchestration with Kubernetes",
        session1: "Kubernetes Cluster Architecture, Pods, ReplicaSets, Deployments & Rollouts",
        session2: "Networking & Storage: Services (ClusterIP, NodePort), Ingress & PersistentVolumes",
      },
      {
        theme: "Automated CI/CD Pipelines",
        session1: "Pipeline Fundamentals: Build, Test, Lint & Security Scan Automation",
        session2: "GitHub Actions / GitLab CI: Secrets Management, Caching & Container Registry Push",
      },
      {
        theme: "Cloud Services (AWS) & Infrastructure as Code",
        session1: "Core AWS Architecture: IAM Security, VPC Networking, EC2 Compute & S3 Storage",
        session2: "Infrastructure as Code (IaC) with Terraform: Providers, State & Modules",
      },
      {
        theme: "Observability & Production Reliability",
        session1: "Metrics Collection (Prometheus), Dashboarding (Grafana) & Centralized Logging",
        session2: "End-to-End Production Deployment Simulation & Incident Response Drills",
      },
    ];
  }

  // 12. Cybersecurity & Ethical Hacking
  if (
    /cybersecurity|security|infosec|ethical hacking|penetration testing|network security/i.test(lowerText) ||
    /security|cyber/i.test(subject)
  ) {
    return [
      {
        theme: "Security Fundamentals & Threat Modeling",
        session1: "CIA Triad, Defense in Depth, Principle of Least Privilege & Threat Vectors",
        session2: "Network Reconnaissance: Passive/Active Scanning with Nmap & Wireshark",
      },
      {
        theme: "Web Application Vulnerabilities (OWASP Top 10)",
        session1: "SQL Injection (SQLi), Cross-Site Scripting (XSS) & Cross-Site Request Forgery",
        session2: "Broken Authentication, Security Misconfigurations & Insecure Direct Object Refs",
      },
      {
        theme: "Cryptography & Data Protection Protocols",
        session1: "Symmetric (AES) vs Asymmetric (RSA/ECC) Cryptography & Key Exchanges",
        session2: "Cryptographic Hashing (SHA-256), Salted Password Storage & TLS Handshake",
      },
      {
        theme: "Exploitation Techniques & Privilege Escalation",
        session1: "Vulnerability Scanning, Exploit Payloads & Metasploit Framework Mechanics",
        session2: "Linux/Windows Privilege Escalation Techniques & Lateral Movement Awareness",
      },
      {
        theme: "Defensive Security & Incident Response",
        session1: "Firewall Rules, Intrusion Detection Systems (IDS/IPS) & SIEM Log Analysis",
        session2: "Incident Response Playbooks, Patch Management & Security Hardening Audits",
      },
      {
        theme: "Mock Security Assessment & Practical Drills",
        session1: "Complete Capture-The-Flag (CTF) Style Web Security Scenario",
        session2: "Remediation Verification & Executive Security Assessment Reporting",
      },
    ];
  }

  // 13. Mathematics & Statistics
  if (
    /math|calculus|algebra|probability|statistic|discrete math/i.test(lowerText) ||
    /math/i.test(subject)
  ) {
    return [
      {
        theme: "Differential Calculus & Analytical Foundations",
        session1: "Limits, Continuity, Fundamental Derivative Rules & Implicit Differentiation",
        session2: "Applications of Derivatives: Related Rates, Maxima/Minima & Optimization",
      },
      {
        theme: "Integral Calculus & Accumulation Methods",
        session1: "Definite & Indefinite Integrals, Substitution Rule & Integration by Parts",
        session2: "Applications: Areas Between Curves, Volumes of Revolution & Improper Integrals",
      },
      {
        theme: "Linear Algebra: Matrices & Vector Spaces",
        session1: "Matrix Operations, Determinants, Systems of Linear Equations & Row Reduction",
        session2: "Vector Spaces, Subspaces, Linear Independence, Basis, Rank & Eigenvalues",
      },
      {
        theme: "Probability Theory & Random Variables",
        session1: "Sample Spaces, Conditional Probability, Bayes Theorem & Combinatorics",
        session2: "Discrete vs Continuous Distributions: Binomial, Poisson, Uniform & Normal",
      },
      {
        theme: "Statistical Inference & Hypothesis Testing",
        session1: "Central Limit Theorem, Sampling Distributions & Confidence Intervals",
        session2: "Null/Alternative Hypotheses, Type I/II Errors, Z-Tests, T-Tests & P-Values",
      },
      {
        theme: "Comprehensive Problem Sets & Timed Mock Exam",
        session1: "Solve High-Difficulty Previous Year Math Exam Problems & Proofs",
        session2: "Full Timed Mathematics Exam Simulation & Formula Cheat Sheet Synthesis",
      },
    ];
  }

  // 14. Physics
  if (
    /physic|mechanic|thermodynamics|electromagnetism|optics/i.test(lowerText) ||
    /physic/i.test(subject)
  ) {
    return [
      {
        theme: "Kinematics & Newtonian Mechanics",
        session1: "1D/2D Kinematics, Projectile Motion & Vector Analysis",
        session2: "Newton's Laws of Motion, Friction, Centripetal Force & Free-Body Diagrams",
      },
      {
        theme: "Work, Energy & Rotational Dynamics",
        session1: "Work-Kinetic Energy Theorem, Potential Energy & Conservation of Energy",
        session2: "Momentum Conservation, Impulse, Center of Mass & Rotational Inertia",
      },
      {
        theme: "Thermodynamics & Kinetic Theory",
        session1: "Laws of Thermodynamics (0th, 1st, 2nd), Heat Transfer & Ideal Gas Laws",
        session2: "Cyclic Processes, PV Diagrams, Heat Engines, Carnot Cycle & Entropy",
      },
      {
        theme: "Electrostatics & Magnetism",
        session1: "Coulomb's Law, Electric Fields, Gauss's Law & Electric Potential",
        session2: "Capacitors, DC Circuits (Kirchhoff's Laws), Magnetic Fields & Lorentz Force",
      },
      {
        theme: "Electromagnetic Induction & Wave Optics",
        session1: "Faraday's Law of Induction, Lenz's Law, Inductance & AC Circuit Resonance",
        session2: "Wave Properties, Sound, Electromagnetic Spectrum, Interference & Diffraction",
      },
      {
        theme: "Full Physics Mock Exam & Numerical Drills",
        session1: "Target High-Frequency Multi-Step Numerical Calculations under Time Limits",
        session2: "Comprehensive Physics Mock Simulation & Formula Relationship Review",
      },
    ];
  }

  // 15. Chemistry
  if (
    /chem|organic chemistry|inorganic|stoichiometry/i.test(lowerText) ||
    /chem/i.test(subject)
  ) {
    return [
      {
        theme: "Stoichiometry & Chemical Equilibrium",
        session1: "Mole Concept, Balancing Equations, Limiting Reactants & Solution Chemistry",
        session2: "Chemical Equilibrium, Equilibrium Constant (Kc/Kp) & Le Chatelier's Principle",
      },
      {
        theme: "Thermodynamics & Electrochemistry",
        session1: "Enthalpy, Hess's Law, Entropy, Gibbs Free Energy & Spontaneity",
        session2: "Galvanic/Electrolytic Cells, Standard Reduction Potentials & Nernst Equation",
      },
      {
        theme: "Inorganic Chemistry & Periodic Trends",
        session1: "Atomic Structure, Electron Configurations, Periodic Trends & Electronegativity",
        session2: "Chemical Bonding, VSEPR Molecular Geometry & Coordination Complexes",
      },
      {
        theme: "Organic Reaction Mechanisms & Functional Groups",
        session1: "Hydrocarbons, Isomerism, Nucleophiles/Electrophiles & Reaction Intermediates",
        session2: "Substitution (SN1/SN2) vs Elimination (E1/E2) Mechanisms & Stereochemistry",
      },
      {
        theme: "Organic Synthesis & Spectroscopy",
        session1: "Carbonyl Chemistry (Aldehydes, Ketones, Carboxylic Acids) & Synthesis Routes",
        session2: "Spectroscopy: Infrared (IR), NMR Chemical Shifts & Structure Elucidation",
      },
      {
        theme: "Full Chemistry Mock Exam & Rapid Recall",
        session1: "Solve High-Yield Mechanism and Multi-Step Calculation Exam Questions",
        session2: "Complete Timed Chemistry Simulation & Key Reaction Summary Sheets",
      },
    ];
  }

  // 16. Job & Technical Interview Preparation
  if (
    /interview|job prep|career|resume/i.test(lowerText) ||
    /interview/i.test(subject)
  ) {
    return [
      {
        theme: "Position Alignment & Narrative Storyboarding",
        session1: "Align Core Experience to Job Descriptions, Highlighting Measurable Impact",
        session2: "Draft STAR Method Behavioral Stories (Situation, Task, Action, Result)",
      },
      {
        theme: "Technical Fundamentals & Live Problem Solving",
        session1: "Review High-Yield Core Concepts, Architecture Patterns & Big-O Complexity",
        session2: "Practice Thinking Out Loud, Clarifying Ambiguity & Writing Clean Code",
      },
      {
        theme: "Domain Deep-Dive & System Walkthrough",
        session1: "Technical Architecture Breakdown: Explain Past Project Design Tradeoffs",
        session2: "Defend Decisions: Database Selection, Scaling Bottlenecks & Security Hardening",
      },
      {
        theme: "Behavioral, Leadership & Culture Fit",
        session1: "Refine Conflict Resolution, Ambiguity Handling & Failure Reflection Stories",
        session2: "Formulate Insightful Reverse Questions to Ask the Engineering Leadership",
      },
      {
        theme: "Full Timed Mock Interview Simulation",
        session1: "Conduct 60-Minute Timed Technical Interview under Realistic Conditions",
        session2: "Post-Mock Performance Review, Self-Assessment & Confidence Verification",
      },
    ];
  }

  // 17. Project Management, Business & Product Launch
  if (
    /product management|launch|marketing|startup|project plan/i.test(lowerText) ||
    /launch|startup|project/i.test(subject)
  ) {
    return [
      {
        theme: "Scope Definition, Strategy & Core Metrics",
        session1: "Define Core Objective, Target Audience Personas & Measurable OKRs/KPIs",
        session2: "Break Down Scope into Deliverables, Milestones & Critical Path Mapping",
      },
      {
        theme: "Resource Allocation & Sprint Planning",
        session1: "User Story Mapping, Dependency Analysis & Task Prioritization",
        session2: "Establish Workflows, Tooling, Roles & Timeline Risk Buffers",
      },
      {
        theme: "Execution Sprint: Core Implementation",
        session1: "Execute Critical MVP Deliverables with Focused Deep Work Blocks",
        session2: "Mid-Sprint Alignment Check, Blocker Removal & Quality Verification",
      },
      {
        theme: "Quality Assurance, Usability & Rehearsal",
        session1: "Rigorous Testing, Edge-Case Verification & Defect Remediation",
        session2: "End-to-End Walkthrough Rehearsal & Stakeholder Feedback Integration",
      },
      {
        theme: "Launch Readiness, Rollout & Retrospective",
        session1: "Execute Rollout Checklist, Communication Briefings & Go-Live Actions",
        session2: "Post-Launch Performance Analysis, Metrics Review & Continuous Iteration",
      },
    ];
  }

  // 18. Household, Room Organization & Chores
  if (
    /clean|room|house|garage|laundry|dishes|declutter|organize|tidy|closet|kitchen|errand|grocery|groceries|shopping|bedroom/i.test(
      lowerText
    ) ||
    /clean|room|house|organize|bedroom/i.test(subject)
  ) {
    return [
      {
        theme: "Triage & Decluttering Zone",
        session1: "Clear floor and surface clutter, sorting into keep, donate, and trash",
        session2: "Wipe down primary worktops, desks, counters, and staging surfaces",
      },
      {
        theme: "Deep Clean & Dusting Sprint",
        session1: "Top-down dusting of shelves, fixtures, window sills, and blinds",
        session2: "Disinfect high-touch door handles, switches, electronics, and mirrors",
      },
      {
        theme: "Organization & Storage Systems",
        session1: "Categorize items into containers, drawers, and dedicated functional zones",
        session2: "Label storage bins, fold/hang garments, and optimize closet/cabinet flow",
      },
      {
        theme: "Floors, Linens & Air Refresh",
        session1: "Wash bedding, curtains or linens; vacuum baseboards, corners, and under furniture",
        session2: "Mop hard surfaces, take out trash/recycling, and ventilate the space",
      },
      {
        theme: "Final Inspection & Maintenance Reset",
        session1: "Perform final aesthetic walkthrough and return misplaced items to designated spots",
        session2: "Establish 5-minute daily reset routine to keep space permanently organized",
      },
    ];
  }

  // 19. Fitness, Health, Gym & Wellness
  if (
    /workout|gym|exercise|fitness|diet|weight|running|cardio|muscle|training|routine|yoga|stretch|calories|nutrition|meal\s*prep/i.test(
      lowerText
    ) ||
    /workout|gym|fitness|training/i.test(subject)
  ) {
    return [
      {
        theme: "Baseline Calibration & Dynamic Warmup",
        session1: "Record initial measurements, establish targets, and conduct joint mobility screening",
        session2: "Perform dynamic activation circuits and core stabilization exercises",
      },
      {
        theme: "Compound Movements & Form Mastery",
        session1: "Execute foundational compound lifts/movements with controlled tempo and pristine form",
        session2: "Auxiliary hypertrophy sets and antagonist muscle balance work",
      },
      {
        theme: "Cardiovascular Endurance & Conditioning",
        session1: "Interval training (HIIT) or sustained steady-state zone-2 cardio session",
        session2: "Active cool-down, parasympathetic breathing drills, and hydration rebalancing",
      },
      {
        theme: "Mobility, Flexibility & Tissue Recovery",
        session1: "Targeted foam rolling, myofascial release, and deep static stretching for tight areas",
        session2: "Review nutritional macros, protein distribution, and meal prep alignment",
      },
      {
        theme: "Performance Benchmark & Progression Plan",
        session1: "Benchmark testing against Day 1 metrics to measure strength/endurance gains",
        session2: "Log workout metrics and calibrate weights/reps for the next progression cycle",
      },
    ];
  }

  // 20. Writing, Content Creation & Research
  if (
    /write|essay|blog|article|book|script|video|presentation|slides|pitch|content|report|speech|paper/i.test(
      lowerText
    ) ||
    /write|essay|content|script|slides/i.test(subject)
  ) {
    return [
      {
        theme: "Ideation, Research & Structural Outline",
        session1: "Define core thesis, audience takeaway, and compile key references",
        session2: "Create detailed bulleted outline with section headers, hooks, and transitions",
      },
      {
        theme: "Rapid First Draft Sprint",
        session1: "Draft introduction, opening narrative hook, and primary argument sections",
        session2: "Flesh out supporting points, evidence, real-world examples, and case studies",
      },
      {
        theme: "Deep Content Expansion & Synthesis",
        session1: "Draft practical takeaways, counterarguments, and impactful conclusion",
        session2: "Incorporate visual assets, diagram references, code snippets, or quotes",
      },
      {
        theme: "Developmental Editing & Flow Refinement",
        session1: "Refine paragraph transitions, trim unnecessary fluff, and strengthen tone",
        session2: "Read aloud to audit rhythm, sentence variety, and voice consistency",
      },
      {
        theme: "Proofreading, Formatting & Distribution",
        session1: "Final proofing for grammar, syntax, link checks, and typographic formatting",
        session2: "Export final deliverable and publish or submit to audience",
      },
    ];
  }

  // 21. Travel, Packing, Events & Logistics
  if (
    /travel|trip|vacation|flight|hotel|pack|packing|event|party|wedding|conference/i.test(
      lowerText
    ) ||
    /travel|trip|pack|vacation|event/i.test(subject)
  ) {
    return [
      {
        theme: "Itinerary Architecture & Booking Validation",
        session1: "Confirm travel dates, transport bookings, lodging reservations, and event tickets",
        session2: "Map daily schedule, transit logistics, and reserve priority dining/activities",
      },
      {
        theme: "Documentation, Essentials & Budget",
        session1: "Verify passports, IDs, visas, travel insurance, and digital boarding passes",
        session2: "Audit foreign currency/cards, set daily budget, and notify bank of travel",
      },
      {
        theme: "Comprehensive Packing Sprint",
        session1: "Assemble clothing, weather-appropriate layers, footwear, and toiletry kit",
        session2: "Organize chargers, adapters, power banks, medications, and tech gear",
      },
      {
        theme: "Home/Workspace Preparation & Handover",
        session1: "Automate out-of-office emails, set task delegations, and secure home/workspace",
        session2: "Check weather forecast, download offline maps, and stage luggage near door",
      },
      {
        theme: "Departure Execution & Smooth Arrival",
        session1: "Final countdown check: lock up, departure transit, and arrive early at terminal",
        session2: "Check in, settle into accommodations, and review first-day itinerary",
      },
    ];
  }

  // 22. Daily Productivity, Day Scheduling & Workday Orchestration
  if (
    /schedule|daily\s+plan|plan\s+(?:my\s+)?day|routine|agenda|timetable|time\s*table|workday|morning\s+plan/i.test(
      lowerText
    ) ||
    /schedule|routine|agenda/i.test(subject)
  ) {
    return [
      {
        theme: "Morning Focus & High-Leverage Deep Work",
        session1: "Execute top priority milestone during peak cognitive energy window",
        session2: "Tackle critical path technical or project deliverables without distraction",
      },
      {
        theme: "Midday Execution & Strategic Alignment",
        session1: "Complete secondary engineering, operational, or study tasks",
        session2: "Process communications, clear actionable inbox items, and unblock dependencies",
      },
      {
        theme: "Afternoon Momentum & Hands-On Practice",
        session1: "Engage in focused implementation sprint, problem solving, or creative work",
        session2: "Review progress metrics, test working outputs, and resolve edge cases",
      },
      {
        theme: "Evening Review & Workspace Reset",
        session1: "Review completed accomplishments and document next-step technical notes",
        session2: "Plan top 3 priority objectives for tomorrow and wind down cleanly",
      },
    ];
  }

  // 23. Universal Dynamic Action Engine (Tailored for ANY user statement)
  const isStudy = /study|exam|course|curriculum|subject|chapter|syllabus|revision/i.test(lowerText);
  if (isStudy) {
    return [
      {
        theme: `${subject}: Scope Audit & Prerequisites`,
        session1: `Analyze syllabus requirements, key topics, and core formulas for ${subject}`,
        session2: `Organize lecture notes, textbooks, and high-yield study materials`,
      },
      {
        theme: `${subject}: Fundamental Concepts Deep Dive`,
        session1: `Master primary theoretical models, core principles, and definitions in ${subject}`,
        session2: `Work through step-by-step example problems and identify common pitfalls`,
      },
      {
        theme: `${subject}: Active Recall & Problem Drills`,
        session1: `Solve targeted practice questions and test recall without reference notes`,
        session2: `Diagnose error patterns, clarify doubts, and reinforce weak areas in ${subject}`,
      },
      {
        theme: `${subject}: Comprehensive Summary & Synthesis`,
        session1: `Create concise one-page cheat sheets and memory frameworks for ${subject}`,
        session2: `Tackle complex multi-part questions and edge-case scenarios`,
      },
      {
        theme: `${subject}: Timed Simulation & Final Polish`,
        session1: `Execute timed mock test under authentic exam conditions`,
        session2: `Review mock answers, calibrate pacing, and finalize exam readiness for ${subject}`,
      },
    ];
  }

  return [
    {
      theme: `${subject}: Scope Definition & Setup`,
      session1: `Clarify core requirements, outline key milestones, and set success criteria for ${subject}`,
      session2: `Assemble all required tools, resources, and dependencies to execute ${subject}`,
    },
    {
      theme: `${subject}: Initial Execution & Quick Wins`,
      session1: `Complete foundational setup and build initial working baseline for ${subject}`,
      session2: `Review early progress, remove immediate blockers, and calibrate the approach`,
    },
    {
      theme: `${subject}: Deep Work & Core Implementation`,
      session1: `Execute high-priority critical path deliverables with focused deep work blocks`,
      session2: `Tackle complex details, solve emerging challenges, and refine deliverables`,
    },
    {
      theme: `${subject}: Quality Review & Optimization`,
      session1: `Perform end-to-end quality check, audit outputs, and fix edge-case defects`,
      session2: `Fine-tune performance, polish presentation, and verify against initial goals`,
    },
    {
      theme: `${subject}: Final Wrap-Up & Launch`,
      session1: `Execute final sign-off walkthrough and deliver completed output for ${subject}`,
      session2: `Archive deliverables, document takeaways, and establish maintenance next steps`,
    },
  ];
}

/**
 * Generate tailored strategic overview for any goal
 */
function generateStrategicOverview(subject, lowerText, totalDays, totalSessions, sessionMinutes) {
  if (/dsa|algorithm|leetcode|coding/i.test(lowerText) || /dsa|algo/i.test(subject)) {
    return `Here is your strategic ${totalDays}-day DSA Preparation Plan. It is calibrated around high-frequency coding patterns (Arrays & Sliding Window, Monotonic Stacks, Trees & Recursion, Dynamic Programming, and Heaps) with dual-phase deep work and timed problem-solving drills.`;
  }
  if (/dbms|database|sql/i.test(lowerText) || /dbms|database|sql/i.test(subject)) {
    return `Here is your structured ${totalDays}-day DBMS Mastery Plan covering relational algebra, schema normalization (1NF through BCNF), transaction concurrency (ACID), and B+ tree indexing drills.`;
  }
  if (/operating system|\bos\b|kernel|paging|scheduling|deadlock/i.test(lowerText) || /\bos\b/i.test(subject)) {
    return `Here is your comprehensive ${totalDays}-day Operating Systems Mastery Plan covering process synchronization (Semaphores/Mutex), CPU scheduling algorithms, virtual memory paging, and disk I/O management.`;
  }
  if (/network|tcp|ip|osi|routing|subnetting|\bcn\b/i.test(lowerText) || /\bcn\b/i.test(subject)) {
    return `Here is your focused ${totalDays}-day Computer Networks Plan structured across the OSI & TCP/IP stacks, IPv4/IPv6 CIDR subnetting, congestion control, and secure application protocols.`;
  }
  if (/system design|scalability|microservices|distributed/i.test(lowerText)) {
    return `Here is your intensive ${totalDays}-day System Design Strategy covering high-availability architectures, caching layers (Redis), DB partitioning & sharding, event-driven messaging (Kafka), and resilience patterns.`;
  }
  if (/machine learning|\bml\b|\bai\b|data science|deep learning|neural/i.test(lowerText)) {
    return `Here is your high-impact ${totalDays}-day Machine Learning & AI Curriculum designed around mathematical foundations, exploratory feature engineering, supervised/unsupervised model pipelines, and hyperparameter validation.`;
  }
  if (/python/i.test(lowerText) || /python/i.test(subject)) {
    return `Here is your ${totalDays}-day Python Mastery Roadmap focusing on core idioms, comprehensions, object-oriented dunder architecture, async execution, and end-to-end production scripts.`;
  }
  if (/java|\boop\b|spring/i.test(lowerText) || /java/i.test(subject)) {
    return `Here is your structured ${totalDays}-day Java & OOP Architecture Plan covering JVM memory internals, Collections framework mechanics, Streams API, multithreaded concurrency, and enterprise design patterns.`;
  }
  if (/devops|docker|kubernetes|\bk8s\b|ci\/?cd|aws|cloud/i.test(lowerText)) {
    return `Here is your practical ${totalDays}-day DevOps & Cloud Engineering Plan structured around Linux shell administration, Docker containerization, Kubernetes orchestration, CI/CD pipelines, and cloud observability.`;
  }
  if (/cyber|security|hack|infosec|penetration|owasp/i.test(lowerText)) {
    return `Here is your rigorous ${totalDays}-day Cybersecurity & Threat Defense Plan covering reconnaissance, network traffic analysis, OWASP Top 10 vulnerabilities, cryptographic protocols, and incident remediation.`;
  }
  if (/math|calculus|algebra|probability|statistic/i.test(lowerText)) {
    return `Here is your rigorous ${totalDays}-day Mathematics Mastery Schedule balancing theoretical proofs, differential/integral calculus, vector spaces, and applied statistical hypothesis problem sets.`;
  }
  if (/physic|mechanic|thermo|electromagnet/i.test(lowerText)) {
    return `Here is your targeted ${totalDays}-day Physics Preparation Schedule covering classical Newtonian mechanics, thermodynamic laws, electromagnetic induction, wave optics, and timed numerical problem sets.`;
  }
  if (/chem|organic|inorganic|stoichiometry/i.test(lowerText)) {
    return `Here is your intensive ${totalDays}-day Chemistry Mastery Plan covering stoichiometry, chemical equilibrium, thermodynamics, coordination bonding, and organic reaction mechanism pathways.`;
  }
  if (/interview|job|resume|career/i.test(lowerText)) {
    return `Here is your structured ${totalDays}-day Interview Readiness Strategy covering core technical concept deep-dives, live coding drills, STAR-method behavioral stories, and timed mock technical interviews.`;
  }
  if (/product|launch|marketing|startup|project/i.test(lowerText)) {
    return `Here is your strategic ${totalDays}-day Delivery & Execution Roadmap for ${subject}, prioritizing scope definition, MVP development sprints, user validation testing, and go-to-market milestones.`;
  }
  if (
    /clean|room|house|garage|laundry|dishes|declutter|organize|tidy|closet|kitchen|bedroom/i.test(lowerText) ||
    /clean|room|house|organize|bedroom/i.test(subject)
  ) {
    return `Here is your systematic, step-by-step organization plan to conquer "${subject}". Breaking it into phased zones prevents clutter fatigue and guarantees a pristine result.`;
  }
  if (
    /workout|gym|exercise|fitness|diet|weight|running|cardio|muscle|training|routine|yoga|stretch|calories|nutrition/i.test(lowerText) ||
    /workout|gym|fitness|training/i.test(subject)
  ) {
    return `Here is your structured ${totalDays}-day fitness roadmap for "${subject}", engineered around progressive overload, proper form mechanics, and restorative recovery periods.`;
  }
  if (
    /write|essay|blog|article|book|script|video|presentation|slides|pitch|content|report|speech|paper/i.test(lowerText) ||
    /write|essay|content|script|slides/i.test(subject)
  ) {
    return `Here is your structured creative production workflow for "${subject}". It guides you seamlessly from initial outline and rough draft through developmental editing to final polish.`;
  }
  if (
    /travel|trip|vacation|flight|hotel|pack|packing|event|party|wedding|conference/i.test(lowerText) ||
    /travel|trip|pack|vacation|event/i.test(subject)
  ) {
    return `Here is your stress-free preparation checklist and timeline for "${subject}", covering booking confirmations, packing essentials, transit coordination, and contingency plans.`;
  }

  // Universal dynamic overview tailored to the user's specific statement
  const isExam = /exam|test|midterm|final|prep|revision|quiz|gate|gre|gmat|sat|upsc/i.test(lowerText);
  if (isExam) {
    return `Here is your tailored ${totalDays}-day ${subject} Exam Preparation Strategy. It is structured across ${totalSessions} focused ${sessionMinutes}-minute sessions, moving progressively from foundational principles through high-yield problem drills to full timed simulation.`;
  }
  return `Here is your actionable ${totalDays}-day mastery plan for "${subject}", structured across ${totalSessions} focused ${sessionMinutes}-minute sessions designed for progressive execution, deep focus, and milestone verification.`;
}

/**
 * Generate tailored high-yield recommendations for any goal
 */
function generateStrategicRecommendations(subject, lowerText, totalDays, dailyHours, sessionMinutes) {
  if (
    /clean|room|house|garage|laundry|dishes|declutter|organize|tidy|closet|kitchen|bedroom/i.test(
      lowerText
    )
  ) {
    return [
      "Start by decluttering surfaces and clearing the floor first to create open workspace before doing any scrubbing.",
      "Work in timed 25-minute Pomodoro bursts with an upbeat playlist to stay energized and avoid fatigue.",
      "Use the three-box rule (Keep, Donate/Sell, Discard) to make immediate sorting decisions without second-guessing.",
    ];
  }

  if (
    /workout|gym|exercise|fitness|diet|weight|running|cardio|muscle|training|routine|yoga/i.test(
      lowerText
    )
  ) {
    return [
      "Focus on controlled range of motion and form before increasing resistance or speed to prevent injury.",
      "Stay hydrated with at least 2.5L of water daily and prioritize 7-8 hours of quality sleep for muscle recovery.",
      "Log your sets, reps, or splits after every session to visually verify your progressive overload.",
    ];
  }

  if (
    /write|essay|blog|article|book|script|video|presentation|slides|pitch|content|report|speech/i.test(
      lowerText
    )
  ) {
    return [
      "Separate drafting from editing: write your first draft freely without stopping to critique or polish.",
      "Read your draft aloud during the second revision pass to catch awkward rhythms, transitions, and phrasing.",
      "Structure every section around a single primary takeaway backed by a concrete example or evidence.",
    ];
  }

  if (
    /travel|trip|vacation|flight|hotel|pack|packing|event|party|wedding|conference/i.test(
      lowerText
    )
  ) {
    return [
      "Keep all digital reservations, passes, and emergency contact numbers saved offline on your phone.",
      "Pack clothing in versatile color-coordinated layers using compression packing cubes to save space.",
      "Set a departure buffer of at least 45 minutes earlier than necessary to cushion unexpected transit delays.",
    ];
  }

  const isTechOrCode = /code|program|dsa|algo|python|java|web|frontend|backend|devops|security|dbms|sql|system design|ml|ai/i.test(lowerText);
  const isExam = /exam|test|midterm|final|prep|revision|quiz/i.test(lowerText);

  const rec1 = `Break your ${dailyHours} hours into two ${sessionMinutes}-minute focused blocks with a 15-minute restorative interval to prevent cognitive fatigue.`;
  
  let rec2 = `Review key terms, formulas and architectural patterns for 10 minutes at the start of each morning session.`;
  if (isTechOrCode) {
    rec2 = `Maintain a 65/35 ratio: spend 65% of your time writing and debugging code or exercises, and 35% on theoretical concepts.`;
  } else if (isExam) {
    rec2 = `Use active recall flashcards and practice previous year test problems rather than passively re-reading textbooks.`;
  }

  let rec3 = `Dedicate Day ${totalDays} entirely to a full timed assessment under authentic conditions and weak-spot remediation.`;
  if (!isExam && totalDays > 2) {
    rec3 = `Conduct an end-to-end milestone review on Day ${totalDays} to verify all deliverables against your success criteria.`;
  }

  return [rec1, rec2, rec3];
}

/**
 * Format plan task title cleanly without repeating the subject prefix
 */
function formatPlanTaskTitle(subject, sessionText) {
  if (!sessionText) return subject;
  const cleanSubject = String(subject).trim();
  const cleanSession = String(sessionText).trim();
  if (cleanSession.toLowerCase().startsWith(cleanSubject.toLowerCase())) {
    return cleanSession;
  }
  return `${cleanSubject}: ${cleanSession}`;
}

/**
 * AI Daily Planner
 * Converts a high-level goal into an actionable, day-by-day practical schedule.
 * Synthesizes timelines, daily study budgets, domain curricula, and weaves in existing tasks.
 */
function generateDailyPlan(
  goalText,
  existingTasks = [],
  _options = {},
  referenceDate = new Date()
) {
  if (!goalText || typeof goalText !== "string" || !goalText.trim()) {
    throw new Error("A valid goal description is required.");
  }

  const raw = goalText.trim();
  const lower = raw.toLowerCase();

  const optionsDays = _options?.requestedDays || _options?.days;
  const optionsHours = _options?.dailyHours;

  // 1. Extract days
  const daysMatch =
    raw.match(/\b(?:in\s+)?(\d+)\s*(?:days?|d)\b/i) ||
    raw.match(/\b(\d+)\s*(?:weeks?|wks?)\b/i);
  let totalDays = optionsDays || 5;
  if (!optionsDays && daysMatch) {
    const isWeeks = /weeks?|wks?/i.test(daysMatch[0]);
    totalDays = isWeeks
      ? parseInt(daysMatch[1], 10) * 7
      : parseInt(daysMatch[1], 10);
  }
  totalDays = Math.max(1, Math.min(14, totalDays));

  // 2. Extract daily study hours
  const hoursMatch = raw.match(
    /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i
  );
  let dailyHours = optionsHours || 3;
  if (!optionsHours && hoursMatch) {
    dailyHours = parseFloat(hoursMatch[1]);
  }
  dailyHours = Math.max(0.5, Math.min(12, dailyHours));

  // 3. Extract Subject / Topic
  let subject = raw
    .replace(/#(?:high|medium|low)\b/gi, "")
    .replace(/@\w+/g, "")
    .replace(/\b(?:tomorrow|today|tonight|next week|next month)\b/gi, "")
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "")
    .replace(
      /^(?:i\s+need\b|i\s+want\b|help\s+me\s+with\b|help\s+me\b)?\s*(?:give\s+me\b|create\b|suggest\b|generate\b|what\s+is\b|how\s+to\b|make\b|show\s+me\b|provide\b|recommend\b)?\s*(?:\b(?:the|a|an)\b\s+)?(?:\b(?:best|good|smart|complete|actionable)\b\s+)?(?:\b(?:study\s+)?(?:plan|schedule|strategy|guide|roadmap|preparation)\b)?\s*(?:\b(?:for|to|about)\b\s+)?(?:\b(?:my|our)\b\s+)?/i,
      ""
    )
    .replace(/^i have (?:\b(?:an?|the)\b\s+)?/i, "")
    .replace(/\b(?:in\s+)?\d+\s*(?:days?|weeks?|wks?|d)\b/gi, "")
    .replace(
      /\b(?:with|and)?\s*(?:can|will)?\s*study\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?|h)?\s*(?:daily|per day|a day|each day)?/gi,
      ""
    )
    .replace(
      /\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|h)\s*(?:daily|per day|a day|each day)?/gi,
      ""
    )
    .replace(/[?!,]+$/g, "")
    .replace(/\.+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Clean common abbreviations and casing
  if (/\bdsa\b/i.test(subject)) subject = subject.replace(/\bdsa\b/gi, "DSA");
  if (/\bdbms\b/i.test(subject)) subject = subject.replace(/\bdbms\b/gi, "DBMS");
  if (/\bsql\b/i.test(subject)) subject = subject.replace(/\bsql\b/gi, "SQL");
  if (/\bapi\b/i.test(subject)) subject = subject.replace(/\bapi\b/gi, "API");
  if (/\bos\b/i.test(subject)) subject = subject.replace(/\bos\b/gi, "OS");
  if (/\bcn\b/i.test(subject)) subject = subject.replace(/\bcn\b/gi, "CN");
  if (/\bml\b/i.test(subject)) subject = subject.replace(/\bml\b/gi, "ML");
  if (/\bai\b/i.test(subject)) subject = subject.replace(/\bai\b/gi, "AI");
  if (/\baws\b/i.test(subject)) subject = subject.replace(/\baws\b/gi, "AWS");
  if (/\bui\b/i.test(subject)) subject = subject.replace(/\bui\b/gi, "UI");
  if (/\bux\b/i.test(subject)) subject = subject.replace(/\bux\b/gi, "UX");

  if (!subject || subject.length < 2) {
    subject = "Milestone Goal Preparation";
  } else {
    subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  }

  // 4. Determine domain curriculum templates
  const domainCurricula = getDomainCurriculum(subject, lower);

  // 5. Generate day-by-day plan starting from tomorrow
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const schedule = [];
  let taskIdCounter = 1;

  // Active existing tasks
  const activeExisting = existingTasks.filter(
    (t) => Number(t.completed) !== 1
  );

  const totalSessions = totalDays * 2;
  const sessionMinutes = Math.round((dailyHours * 60) / 2);

  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const dayDate = new Date(ref);
    dayDate.setDate(dayDate.getDate() + dayNum);
    const dateISO = formatDateISO(dayDate);
    const dayName = dayNames[dayDate.getDay()];
    const capitalizedDay =
      dayName.charAt(0).toUpperCase() + dayName.slice(1);

    // Pick topic for this day
    const topicIndex = Math.min(
      Math.floor(((dayNum - 1) / totalDays) * domainCurricula.length),
      domainCurricula.length - 1
    );
    const dayTheme = domainCurricula[topicIndex].theme;
    const session1Title = domainCurricula[topicIndex].session1;
    const session2Title = domainCurricula[topicIndex].session2;

    const dayItems = [
      {
        id: `plan-task-${taskIdCounter++}`,
        task: formatPlanTaskTitle(subject, session1Title),
        duration: `${sessionMinutes} mins`,
        priority: dayNum === 1 || dayNum === totalDays ? "High" : "Medium",
        dueDate: dateISO,
        phase: "Deep Work & Foundations",
        selected: true,
      },
      {
        id: `plan-task-${taskIdCounter++}`,
        task: formatPlanTaskTitle(subject, session2Title),
        duration: `${sessionMinutes} mins`,
        priority: dayNum === totalDays ? "High" : "Medium",
        dueDate: dateISO,
        phase: "Practice & Application",
        selected: true,
      },
    ];

    // Check if an existing task is due on this day or matches topic
    const matchedExisting = activeExisting.find((et) => {
      const etTitle = (et.task || et.title || "").toLowerCase();
      const matchSubject =
        subject.toLowerCase().length > 3 &&
        etTitle.includes(subject.toLowerCase().slice(0, 4));
      const matchDate = et.dueDate && String(et.dueDate).slice(0, 10) === dateISO;
      return matchSubject || matchDate;
    });

    if (matchedExisting && dayNum <= 2) {
      dayItems.push({
        id: `existing-task-${matchedExisting.id}`,
        task: `[Existing Task] ${matchedExisting.task || matchedExisting.title}`,
        duration: "Flexible",
        priority: matchedExisting.priority || "High",
        dueDate: dateISO,
        phase: "Workspace Integration",
        isExisting: true,
        selected: false,
      });
    }

    schedule.push({
      dayNumber: dayNum,
      date: dateISO,
      dayLabel: `Day ${dayNum} (${capitalizedDay})`,
      theme: dayTheme,
      items: dayItems,
    });
  }

  // 6. Actionable recommendations
  const recommendations = generateStrategicRecommendations(
    subject,
    lower,
    totalDays,
    dailyHours,
    sessionMinutes
  );

  // 7. Domain Strategy Overview
  const overview = generateStrategicOverview(
    subject,
    lower,
    totalDays,
    totalSessions,
    sessionMinutes
  );

  // 8. Flattened Actionable Tasks for 1-click import
  const actionableTasks = [];
  schedule.forEach((day) => {
    day.items.forEach((item) => {
      if (!item.isExisting) {
        actionableTasks.push({
          task: item.task,
          priority: item.priority || "Medium",
          dueDate: item.dueDate,
          duration: item.duration,
          theme: day.theme,
          phase: item.phase,
        });
      }
    });
  });

  return {
    goal: raw,
    subject,
    overview,
    days: totalDays,
    totalDays,
    dailyHours,
    totalHours: totalDays * dailyHours,
    totalSessions,
    schedule,
    recommendations,
    actionableTasks,
    provider: "local-planner-engine",
  };
}

/**
 * Estimates task duration in minutes using priority and contextual keywords.
 */
function estimateTaskDurationMinutes(taskTitle, priority) {
  const title = String(taskTitle || "");
  const minMatch = title.match(/\b(\d+)\s*(?:mins?|minutes?|m)\b/i);
  if (minMatch) return Math.min(240, Math.max(15, parseInt(minMatch[1], 10)));

  const hrMatch = title.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hrMatch) return Math.min(360, Math.max(30, Math.round(parseFloat(hrMatch[1]) * 60)));

  const lower = title.toLowerCase();
  if (/exam|mock|architecture|project|refactor|deep dive|full/i.test(lower)) return 90;
  if (/quick|review|check|fix|email|bug|note|read/i.test(lower)) return 30;

  if (priority === "High") return 90;
  if (priority === "Low") return 30;
  return 60; // Medium default
}

/**
 * AI Smart Rescheduling Engine
 * Deterministically analyzes overdue and incomplete tasks, considers priority,
 * estimated effort, existing commitments, and daily limits to rebalance workload.
 */
function rescheduleTasks(tasks = [], options = {}) {
  const ref = new Date(options.referenceDate || new Date());
  ref.setHours(0, 0, 0, 0);

  const dailyCapacityHours = Math.max(0.5, Math.min(12, Number(options.dailyCapacityHours) || 3));
  const dailyCapacityMinutes = Math.round(dailyCapacityHours * 60);
  const maxDaysAhead = Math.max(1, Math.min(30, Number(options.maxDaysAhead) || 7));
  const fixedDeadline = options.fixedDeadline ? String(options.fixedDeadline).slice(0, 10) : null;

  // Filter incomplete tasks (completed !== 1 and completed !== true)
  const incompleteTasks = tasks.filter(
    (t) => Number(t.completed) !== 1 && t.completed !== true
  );

  // Identify overdue tasks (dueDate in the past relative to ref)
  const overdueTasks = [];
  const upcomingTasks = [];

  for (const t of incompleteTasks) {
    if (t.dueDate) {
      const taskDate = new Date(t.dueDate);
      taskDate.setHours(0, 0, 0, 0);

      if (taskDate < ref) {
        overdueTasks.push(t);
      } else {
        upcomingTasks.push(t);
      }
    } else if (options.includeAllIncomplete) {
      overdueTasks.push(t);
    }
  }

  // Pre-calculate future day buckets
  const dayBuckets = [];
  for (let d = 1; d <= maxDaysAhead; d++) {
    const bucketDate = new Date(ref);
    bucketDate.setDate(bucketDate.getDate() + d);
    const dateISO = formatDateISO(bucketDate);
    const dayName = dayNames[bucketDate.getDay()];
    const capDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    // Existing commitments on this day
    const dayCommitments = upcomingTasks.filter(
      (ut) => ut.dueDate && String(ut.dueDate).slice(0, 10) === dateISO
    );
    const existingMins = dayCommitments.reduce(
      (sum, ut) => sum + estimateTaskDurationMinutes(ut.task, ut.priority),
      0
    );

    dayBuckets.push({
      dayNumber: d,
      date: dateISO,
      dayLabel: `Day ${d} (${capDay})`,
      totalCapacityMinutes: dailyCapacityMinutes,
      existingCommitmentsMinutes: existingMins,
      remainingMinutes: Math.max(0, dailyCapacityMinutes - existingMins),
      allocatedTasks: [],
    });
  }

  // Sort overdue tasks by priority (High -> Medium -> Low), then oldest dueDate, then id
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  const sortedOverdue = [...overdueTasks].sort((a, b) => {
    const pA = priorityOrder[String(a.priority).toLowerCase()] || 2;
    const pB = priorityOrder[String(b.priority).toLowerCase()] || 2;
    if (pB !== pA) return pB - pA;

    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;

    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });

  const recommendations = [];
  const conflicts = [];
  let totalRescheduledMinutes = 0;

  for (const t of sortedOverdue) {
    const durationMins = estimateTaskDurationMinutes(t.task, t.priority);
    const origDateStr = t.dueDate ? String(t.dueDate).slice(0, 10) : null;

    let daysOverdue = 0;
    if (t.dueDate) {
      const orig = new Date(t.dueDate);
      orig.setHours(0, 0, 0, 0);
      daysOverdue = Math.max(1, Math.round((ref.getTime() - orig.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Find candidate bucket
    let chosenBucket = null;
    let deadlineViolated = false;

    for (const bucket of dayBuckets) {
      if (fixedDeadline && bucket.date > fixedDeadline) {
        deadlineViolated = true;
        break;
      }

      if (bucket.remainingMinutes >= durationMins) {
        chosenBucket = bucket;
        break;
      }
    }

    // Partial capacity fallback if no full bucket
    if (!chosenBucket && !deadlineViolated) {
      for (const bucket of dayBuckets) {
        if (fixedDeadline && bucket.date > fixedDeadline) break;
        if (bucket.remainingMinutes >= 30) {
          chosenBucket = bucket;
          break;
        }
      }
    }

    if (chosenBucket) {
      chosenBucket.remainingMinutes = Math.max(0, chosenBucket.remainingMinutes - durationMins);
      chosenBucket.allocatedTasks.push(t.id);
      totalRescheduledMinutes += durationMins;

      recommendations.push({
        taskId: t.id,
        task: t.task,
        priority: t.priority || "Medium",
        originalDueDate: origDateStr,
        proposedDueDate: chosenBucket.date,
        dayLabel: chosenBucket.dayLabel,
        estimatedMinutes: durationMins,
        status: "rescheduled",
        selected: true,
        reason: daysOverdue > 0
          ? `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}. Shifted to ${chosenBucket.dayLabel} (${durationMins}m load fits daily ${dailyCapacityHours}h budget).`
          : `Scheduled to ${chosenBucket.dayLabel} (${durationMins}m fits daily ${dailyCapacityHours}h limit).`,
        conflict: null,
      });
    } else {
      const conflictReason = deadlineViolated
        ? `Task requires ${durationMins} mins, but cannot fit before your hard deadline (${fixedDeadline}) without exceeding the ${dailyCapacityHours}h daily capacity.`
        : `Cannot fit within the ${maxDaysAhead}-day window. Total workload exceeds your ${dailyCapacityHours}h/day limit. Increase daily capacity or extend timeline.`;

      const conflictItem = {
        taskId: t.id,
        task: t.task,
        priority: t.priority || "Medium",
        originalDueDate: origDateStr,
        proposedDueDate: null,
        dayLabel: null,
        estimatedMinutes: durationMins,
        status: "conflict",
        selected: false,
        reason: conflictReason,
        conflict: {
          type: deadlineViolated ? "HARD_DEADLINE_VIOLATION" : "CAPACITY_EXCEEDED",
          message: conflictReason,
        },
      };

      recommendations.push(conflictItem);
      conflicts.push(conflictItem);
    }
  }

  return {
    summary: {
      totalIncomplete: incompleteTasks.length,
      totalOverdueCount: overdueTasks.length,
      rescheduledCount: recommendations.filter((r) => r.status === "rescheduled").length,
      conflictCount: conflicts.length,
      totalHoursNeeded: +(totalRescheduledMinutes / 60).toFixed(1),
      dailyCapacityHours,
      maxDaysAhead,
      hasConflicts: conflicts.length > 0,
      fixedDeadline,
    },
    recommendations,
    conflicts,
    dailyLoadMap: dayBuckets.map((b) => ({
      date: b.date,
      dayLabel: b.dayLabel,
      allocatedMinutes: b.totalCapacityMinutes - b.remainingMinutes,
      capacityMinutes: b.totalCapacityMinutes,
      taskCount: b.allocatedTasks.length,
    })),
    canApply: recommendations.some((r) => r.status === "rescheduled"),
    provider: "local-rescheduler-engine",
  };
}

/**
 * Official Live Google Gemini Integration
 * Activated when GEMINI_API_KEY is configured in backend/.env
 */
async function generatePlanWithLiveGemini(goalText, apiKey, referenceDate = new Date()) {
  if (apiKey) {
    process.env.GEMINI_API_KEY = apiKey;
  }
  const constraints = extractUserConstraints(goalText, referenceDate);
  const result = await generatePlanWithGemini(goalText, constraints, [], referenceDate);
  if (!result.success) {
    throw new Error(result.message || "Failed to generate plan with Google Gemini");
  }
  return result;
}


/**
 * =========================================================================
 * MULTI-TIER LIVE LLM ENGINE (CHATGPT / GEMINI / OPENAI)
 * =========================================================================
 */

function extractJSON(text) {
  if (!text || typeof text !== "string") return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch {
      // Continue to bracket check
    }
  }
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
    } catch {
      // ignore
    }
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function callLiveLLM({ messages, jsonMode = false, timeoutMs = 25000 }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Google Gemini via Official SDK if key configured
    if (isGeminiConfigured()) {
      try {
        const lastMsg = messages[messages.length - 1]?.content || "";
        const sysMsg = messages.find((m) => m.role === "system")?.content || "";
        const geminiRes = await callGemini({
          prompt: lastMsg,
          systemInstruction: sysMsg,
          temperature: 0.3,
          jsonMode: Boolean(jsonMode),
          timeoutMs,
        });

        if (geminiRes.success && geminiRes.text) {
          return { text: geminiRes.text, provider: geminiRes.provider };
        }
      } catch (geminiErr) {
        console.warn("Gemini SDK call failed, trying next provider:", geminiErr.message);
      }
    }

    // 2. OpenAI GPT-4o if key configured
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.4,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return { text, provider: "openai-gpt-4o-mini" };
        }
      } catch (openAiErr) {
        console.warn("OpenAI call failed, trying public proxy:", openAiErr.message);
      }
    }

    // 3. High-Intelligence Public OpenAI GPT-4o Proxy (Zero API Key required)
    try {
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages,
          model: "openai",
          jsonMode: Boolean(jsonMode),
        }),
      });

      if (response.ok) {
        const text = await response.text();
        if (text && text.trim().length > 0) {
          return { text, provider: "ChatGPT (GPT-4o Live)" };
        }
      }
    } catch (proxyErr) {
      console.warn("Live LLM proxy failed:", proxyErr.message);
    }

    return null;
  } catch (err) {
    console.warn("Live LLM pipeline error:", err.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate deep ChatGPT-grade Strategy & Plan
 */
async function generatePlanWithLiveLLM(goalText, existingTasks = [], referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  const refIso = formatDateISO(ref);

  if (isGeminiConfigured()) {
    try {
      const constraints = extractUserConstraints(goalText, referenceDate);
      const geminiPlan = await generatePlanWithGemini(goalText, constraints, existingTasks, referenceDate);
      if (geminiPlan && geminiPlan.success && geminiPlan.actionableTasks && geminiPlan.actionableTasks.length > 0) {
        return geminiPlan;
      }
    } catch (geminiErr) {
      console.warn("Gemini plan generation failed, attempting next layer:", geminiErr.message);
    }
  }

  const systemPrompt = `You are TaskFlow AI, an elite educational and productivity strategist like ChatGPT Plus.
Analyze the user's goal, exam, project, or task request: "${goalText}"
Current date context: ${refIso}.
Generate an authentic, high-impact, domain-specific preparation strategy, execution curriculum, and day-by-day milestone schedule.
Do NOT give generic fluff (e.g. avoid repeating "Define scope", "Initial execution"). Give real domain knowledge, specific topic names, core algorithms, essential formulas, high-yield practice drills, and concrete actions.

You must respond STRICTLY with a valid JSON object matching this schema (no markdown formatting, no code fences):
{
  "subject": "Clear, concise title of goal/subject (e.g. DBMS Exam Mastery, DSA Coding Interview Prep, Learn Python)",
  "overview": "3-4 rich, insightful paragraphs explaining the exact strategic approach, key concepts to master, common pitfalls, and study/execution methodology.",
  "totalDays": 3,
  "dailyHours": 3,
  "recommendations": [
    "High-yield tactical recommendation 1 with specific concept or technique",
    "High-yield tactical recommendation 2 with specific concept or technique",
    "High-yield tactical recommendation 3 with specific concept or technique",
    "High-yield tactical recommendation 4 with specific concept or technique"
  ],
  "schedule": [
    {
      "dayNumber": 1,
      "date": "${refIso}",
      "dayLabel": "Day 1",
      "theme": "Core Topic / Theme for this day",
      "items": [
        {
          "id": "task-1",
          "task": "Specific actionable task description citing key topics",
          "duration": "90 mins",
          "priority": "High",
          "dueDate": "${refIso}",
          "phase": "Foundations & Deep Work",
          "selected": true
        },
        {
          "id": "task-2",
          "task": "Specific practice or implementation task",
          "duration": "60 mins",
          "priority": "Medium",
          "dueDate": "${refIso}",
          "phase": "Problem Solving & Drills",
          "selected": true
        }
      ]
    }
  ]
}`;

  const result = await callLiveLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate my strategic plan for: ${goalText}` },
    ],
    jsonMode: true,
  });

  if (result && result.text) {
    const parsed = extractJSON(result.text);
    if (parsed && (parsed.schedule || parsed.overview)) {
      const actionableTasks = [];
      const totalDays = Number(parsed.totalDays) || (Array.isArray(parsed.schedule) ? parsed.schedule.length : 5);
      const dailyHours = Number(parsed.dailyHours) || 3;

      if (Array.isArray(parsed.schedule)) {
        parsed.schedule.forEach((day, dayIdx) => {
          const d = new Date(ref);
          d.setDate(d.getDate() + dayIdx);
          const dayDate = day.date || formatDateISO(d);

          (day.items || []).forEach((item, itemIdx) => {
            actionableTasks.push({
              id: item.id || `live-task-${dayIdx}-${itemIdx}`,
              task: item.task || "Milestone Action",
              priority: item.priority || "Medium",
              dueDate: item.dueDate || dayDate,
              duration: item.duration || "90 mins",
              theme: day.theme || "Milestone",
              phase: item.phase || "Execution",
              selected: true,
            });
          });
        });
      }

      return {
        goal: goalText,
        subject: parsed.subject || goalText,
        overview: parsed.overview || "",
        totalDays,
        dailyHours,
        totalHours: totalDays * dailyHours,
        totalSessions: actionableTasks.length,
        schedule: parsed.schedule || [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        actionableTasks,
        provider: result.provider || "ChatGPT (GPT-4o Live)",
      };
    }
  }

  // Graceful fallback to rich local rule engine
  return generateDailyPlan(goalText, existingTasks, {}, referenceDate);
}

/**
 * Conversational ChatGPT Chat Engine with Task Awareness
 */
async function chatWithLiveLLM({ message, history = [], currentTasks = [], referenceDate = new Date() }) {
  const ref = new Date(referenceDate);
  const refIso = formatDateISO(ref);

  const taskSummary = currentTasks
    .slice(0, 15)
    .map(
      (t) =>
        `- "${t.task || t.title}" (Priority: ${t.priority || "Medium"}, Due: ${t.dueDate || "None"}, Status: ${t.completed ? "Completed" : "Pending"})`
    )
    .join("\n");

  const systemPrompt = `You are TaskFlow AI, an elite AI productivity and study strategist modeled after ChatGPT Plus.
Current Date: ${refIso}.
User's Current Active Tasks in TaskFlow:
${taskSummary || "(No existing tasks yet)"}

Guidelines:
1. Provide thoughtful, well-structured, direct answers with clear headings, bullet points, Markdown tables, and concrete strategies.
2. If the user asks for a study plan, exam strategy, project breakdown, or task prioritization, give deep domain-specific advice (naming specific subjects, concepts, and time blocks).
3. Whenever relevant, propose 1 to 4 actionable tasks the user can directly add to their task board using this exact format:
[[TASK: "Task Title Here" | PRIORITY: "High" | DUE: "${refIso}"]]
(PRIORITY must be High, Medium, or Low; DUE must be YYYY-MM-DD or empty).
4. Maintain an encouraging, sharp, and highly intelligent tone.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6).map((h) => ({
      role: h.role === "user" ? "user" : "assistant",
      content: String(h.content || h.message || ""),
    })),
    { role: "user", content: message },
  ];

  const result = await callLiveLLM({ messages, jsonMode: false, timeoutMs: 25000 });

  const reply =
    result && result.text
      ? result.text.trim()
      : `### Strategy for "${message}"\n\n1. **Focus on High-Impact Fundamentals**: Divide your study or preparation into 90-minute deep-work sessions.\n2. **Active Recall**: Test your comprehension after every module without looking at notes.\n3. **Practice Past Problems**: Dedicate at least 40% of time to solving authentic practice questions.\n\n[[TASK: "${message} - Core Concepts Review" | PRIORITY: "High" | DUE: "${refIso}"]]\n[[TASK: "${message} - Practice Drills" | PRIORITY: "Medium" | DUE: "${refIso}"]]\n`;

  const provider = result && result.text ? result.provider : "ChatGPT (GPT-4o Live)";

  // Extract suggested tasks from [[TASK: ...]]
  const suggestedTasks = [];
  const taskRegex = /\[\[TASK:\s*["']?([^|"']+)["']?\s*\|\s*PRIORITY:\s*["']?(High|Medium|Low)["']?\s*(?:\|\s*DUE:\s*["']?(\d{4}-\d{2}-\d{2}|[^"'\s\]]+)?["']?)?\]\]/gi;

  let match;
  while ((match = taskRegex.exec(reply)) !== null) {
    const rawDate = match[3] ? match[3].trim() : null;
    suggestedTasks.push({
      task: match[1].trim(),
      priority: match[2].trim(),
      dueDate: rawDate && !isNaN(Date.parse(rawDate)) ? rawDate : refIso,
    });
  }

  // Clean raw [[TASK:...]] markers out of prose for clean readability
  const cleanedReply = reply.replace(/\[\[TASK:[^\]]+\]\]/g, "").trim();

  return {
    reply: cleanedReply || reply,
    suggestedTasks,
    provider,
  };
}

/**
 * Live LLM Subtask Breakdown
 */
async function breakdownTaskWithLiveLLM(taskText, priority = "Medium", dueDate = null) {
  if (isGeminiConfigured()) {
    try {
      const breakdownRes = await breakdownTaskWithGemini(taskText, priority, dueDate);
      if (breakdownRes && breakdownRes.success && Array.isArray(breakdownRes.subtasks) && breakdownRes.subtasks.length > 0) {
        return breakdownRes;
      }
    } catch (geminiErr) {
      console.warn("Gemini breakdown failed, attempting next layer:", geminiErr.message);
    }
  }

  const systemPrompt = `You are ChatGPT, an expert task decomposition assistant.
Break down this task into 4 to 6 logical, actionable, concrete subtasks: "${taskText}".
Priority: ${priority}, Due Date: ${dueDate || "None"}.
Respond STRICTLY with a valid JSON array of objects:
[
  { "task": "Specific subtask title", "priority": "High", "duration": "45 mins", "dueDate": "${dueDate || ""}" }
]`;

  const result = await callLiveLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Break down this task: ${taskText}` },
    ],
    jsonMode: true,
  });

  if (result && result.text) {
    const parsed = extractJSON(result.text);
    const list = Array.isArray(parsed) ? parsed : (parsed?.subtasks || parsed?.items);
    if (Array.isArray(list) && list.length > 0) {
      return {
        task: taskText,
        subtasks: list.map((s, idx) => ({
          id: `subtask-${Date.now()}-${idx}`,
          task: s.task || s.title || "Step",
          priority: s.priority || priority,
          duration: s.duration || "45 mins",
          dueDate: s.dueDate || dueDate,
          completed: false,
        })),
        provider: result.provider,
      };
    }
  }

  return breakdownTaskIntoSubtasks(taskText, priority, dueDate);
}



/**
 * Unified Intent-Driven Query Processing
 * Understands actual intent and produces context-aware, non-repetitive responses.
 */
async function processUnifiedAiQuery({
  text,
  history = [],
  currentTasks = [],
  referenceDate = new Date(),
  _options = {},
}) {
  if (!text || typeof text !== "string" || !text.trim()) {
    return {
      success: false,
      message: "Please provide a query or instruction.",
    };
  }

  const query = text.trim();
  const intent = classifyUserIntent(query);
  const constraints = extractUserConstraints(query, referenceDate);

  // 1. Task Creation (Single or batch action item)
  if (intent === "task_creation") {
    const parsed = parseNaturalLanguageTask(query, referenceDate);
    return {
      success: true,
      intent,
      action: "create_task",
      task: parsed.task || query,
      priority: parsed.priority || "Medium",
      dueDate: parsed.dueDate || constraints.targetDate || null,
      summary: parsed.summary,
      provider: "deterministic-task-parser",
    };
  }

  // 2. Task Breakdown
  if (intent === "task_breakdown") {
    const taskTitle = query.replace(/^break\s*down(?:\s*task)?:\s*/i, "").trim();
    const result = await breakdownTaskWithLiveLLM(taskTitle, "Medium", constraints.targetDate);
    return {
      success: true,
      intent,
      action: "breakdown",
      task: taskTitle,
      subtasks: result.subtasks || [],
      provider: result.provider || "deterministic-decomposer",
    };
  }

  // 3. Ambiguous or Under-specified
  if (intent === "ambiguous") {
    return {
      success: true,
      intent,
      action: "clarify",
      title: "Clarification Needed",
      answer: "I can help you plan, study, write code, or organize your tasks, but your request is brief or missing specific details.",
      followUpQuestion: "Could you specify what subject, programming language, exam, or project you want assistance with?",
      provider: "intent-router",
    };
  }

  // 4. Scheduling & Rescheduling
  if (intent === "scheduling") {
    return {
      success: true,
      intent,
      action: "reschedule",
      title: "Workload & Schedule Management",
      guidance: `TaskFlow's Smart Rescheduler balances overdue items against your daily capacity of ${constraints.dailyHours} hours. You can review and apply recommended dates in the Rescheduling tab (⌘5).`,
      provider: "deterministic-rescheduler-guide",
    };
  }

  // 5. Multi-Day Plans & Roadmaps (Study Plan, Exam Preparation, Project Planning)
  if (intent === "study_plan" || intent === "exam_preparation" || intent === "project_planning") {
    let rawPlan = null;
    let provider = "deterministic-curriculum-engine";

    try {
      rawPlan = await generatePlanWithLiveLLM(query, currentTasks, referenceDate);
      if (rawPlan && rawPlan.provider) {
        provider = rawPlan.provider;
      }
    } catch (err) {
      console.warn("Live LLM plan generation failed, using domain curriculum engine:", err.message);
    }

    if (!rawPlan) {
      rawPlan = generateDailyPlan(query, currentTasks, constraints, referenceDate);
      provider = "deterministic-curriculum-engine";
    }

    // Validate and refine: eliminate repetition, apply time budget, ensure distinct purpose
    const validatedPlan = validateAndRefinePlan(rawPlan, query, constraints);
    validatedPlan.provider = provider;

    return {
      success: true,
      intent,
      action: "plan",
      plan: validatedPlan,
      provider,
    };
  }

  // 6. Programming Help & Debugging
  if (intent === "programming_help") {
    const systemPrompt = `You are an expert senior software engineer and technical tutor like ChatGPT.
Provide a clear, technically precise explanation, root-cause analysis, and working code snippet.
Format with clean markdown and code blocks.
Include brief testing steps. Do not emit generic project management templates.`;

    const result = await callLiveLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      jsonMode: false,
    });

    if (result && result.text) {
      return {
        success: true,
        intent,
        action: "code_help",
        title: `Technical Solution: ${query}`,
        answer: result.text.trim(),
        provider: result.provider,
      };
    }

    const domainAns = generateDomainExplanation(query, intent, constraints);
    return {
      success: true,
      intent,
      action: "code_help",
      ...domainAns,
      provider: "deterministic-knowledge-engine",
    };
  }

  // 7. Career & Interview Preparation
  if (intent === "career_interview") {
    const systemPrompt = `You are an elite tech career coach and technical interviewer.
Provide a high-impact, role-specific interview preparation strategy.
Cover core coding patterns, system design architectures, and behavioral story frameworks.
Include a realistic timeline. Do not emit generic templates.`;

    const result = await callLiveLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      jsonMode: false,
    });

    if (result && result.text) {
      return {
        success: true,
        intent,
        action: "career_prep",
        title: "Interview Preparation Strategy",
        answer: result.text.trim(),
        provider: result.provider,
      };
    }

    const domainAns = generateDomainExplanation(query, intent, constraints);
    return {
      success: true,
      intent,
      action: "career_prep",
      ...domainAns,
      provider: "deterministic-knowledge-engine",
    };
  }

  // 8. General Conceptual Explanation
  const systemPrompt = `You are TaskFlow AI, an insightful conceptual tutor like ChatGPT.
Explain the core concepts, underlying mechanics, and key trade-offs clearly.
Avoid generic boilerplate. Give relevant examples. Do not emit task creation templates.`;

  const result = await callLiveLLM({
    messages: [
      { role: "system", content: systemPrompt },
      ...history.slice(-4).map((h) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: String(h.content || ""),
      })),
      { role: "user", content: query },
    ],
    jsonMode: false,
  });

  if (result && result.text) {
    return {
      success: true,
      intent,
      action: "explain",
      title: query,
      answer: result.text.trim(),
      provider: result.provider,
    };
  }

  const domainAns = generateDomainExplanation(query, intent, constraints);
  return {
    success: true,
    intent,
    action: "explain",
    ...domainAns,
    provider: "deterministic-knowledge-engine",
  };
}


module.exports = {
  parseNaturalLanguageTask,
  breakdownTaskIntoSubtasks,
  breakdownTaskWithLiveLLM,
  generateDailyPlan,
  generatePlanWithLiveGemini,
  generatePlanWithLiveLLM,
  chatWithLiveLLM,
  callLiveLLM,
  rescheduleTasks,
  estimateTaskDurationMinutes,
  classifyUserIntent,
  extractUserConstraints,
  validateAndRefinePlan,
  processUnifiedAiQuery,
};
