/**
 * Google Gemini Official SDK Integration Module for TaskFlow
 *
 * Uses the official @google/generative-ai Node.js SDK to produce
 * context-aware, technically accurate, domain-specific responses.
 *
 * Security:
 * - GEMINI_API_KEY is read exclusively from backend environment.
 * - Key is NEVER leaked to frontend, responses, logs, or git.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Active mock provider for offline testing & quota conservation
let mockProviderInstance = null;

function setMockGeminiProvider(mockFn) {
  mockProviderInstance = mockFn;
}

function clearMockGeminiProvider() {
  mockProviderInstance = null;
}

/**
 * Checks whether GEMINI_API_KEY is configured in backend environment
 */
function isGeminiConfigured() {
  if (mockProviderInstance) return true;
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  return typeof key === "string" && key.trim().length > 10;
}

/**
 * Retrieves configured Gemini API Key without logging it
 */
function getGeminiApiKey() {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
}

/**
 * Retrieves configured model name (default: gemini-1.5-flash)
 */
function getGeminiModelName() {
  return (process.env.GEMINI_MODEL || "gemini-1.5-flash").trim();
}

/**
 * Initializes and returns the official GoogleGenerativeAI client
 */
function getGeminiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Low-level execution wrapper around GoogleGenerativeAI SDK
 */
async function callGemini({
  prompt,
  systemInstruction = "",
  temperature = 0.3,
  jsonMode = false,
  timeoutMs = 20000,
  modelName = null,
}) {
  // If mock provider is active (for automated unit/integration tests)
  if (mockProviderInstance) {
    return await mockProviderInstance({
      prompt,
      systemInstruction,
      temperature,
      jsonMode,
      timeoutMs,
      modelName: modelName || getGeminiModelName(),
    });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "MISSING_KEY",
      message: "GEMINI_API_KEY is not configured in backend/.env",
      provider: "none",
    };
  }

  const targetModel = modelName || getGeminiModelName();
  const genAI = new GoogleGenerativeAI(apiKey);

  const modelConfig = {
    model: targetModel,
    generationConfig: {
      temperature,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (systemInstruction) {
    modelConfig.systemInstruction = systemInstruction;
  }

  const model = genAI.getGenerativeModel(modelConfig);

  // Timeout safety wrapper
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const err = new Error(`Gemini API request timed out after ${timeoutMs / 1000}s`);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
  });

  try {
    const apiCallPromise = model.generateContent(prompt);
    const result = await Promise.race([apiCallPromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    if (!text || !text.trim()) {
      return {
        success: false,
        error: "EMPTY_RESPONSE",
        message: "Gemini API returned an empty response.",
        provider: targetModel,
      };
    }

    return {
      success: true,
      text: text.trim(),
      provider: `google-${targetModel}`,
    };
  } catch (err) {
    const errMsg = String(err.message || err);

    // Classify known API failures gracefully without leaking secrets
    if (/429|quota|rate\s*limit|resource_exhausted/i.test(errMsg)) {
      return {
        success: false,
        error: "QUOTA_EXHAUSTED",
        message: "Gemini API quota or rate limit exceeded. Please check Google AI Studio usage.",
        provider: targetModel,
      };
    }

    if (/400|401|403|api\s*key|invalid_argument|permission_denied/i.test(errMsg)) {
      return {
        success: false,
        error: "INVALID_KEY",
        message: "Google Gemini API key is invalid or unauthorized.",
        provider: targetModel,
      };
    }

    if (/timeout/i.test(errMsg) || err.name === "TimeoutError") {
      return {
        success: false,
        error: "NETWORK_TIMEOUT",
        message: "Gemini API request timed out. Please check network connectivity.",
        provider: targetModel,
      };
    }

    if (/404|not\s*found|models\//i.test(errMsg)) {
      return {
        success: false,
        error: "MODEL_NOT_FOUND",
        message: `Model '${targetModel}' was not found or is unavailable for this API account.`,
        provider: targetModel,
      };
    }

    return {
      success: false,
      error: "API_ERROR",
      message: "An error occurred while contacting the Gemini API.",
      details: errMsg.slice(0, 150),
      provider: targetModel,
    };
  }
}

/**
 * Extracts and safely validates JSON from model response text
 */
function extractAndValidateJSON(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  // Clean markdown code blocks if model included fences
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Locate first '{' or '[' and matching end
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        // continue
      }
    }

    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
      } catch {
        // continue
      }
    }
  }

  return null;
}

/**
 * AI Daily Planner with Google Gemini SDK
 */
async function generatePlanWithGemini(goalText, constraints = {}, _existingTasks = [], referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  const refIso = ref.toISOString().slice(0, 10);
  const requestedDays = constraints.requestedDays || constraints.days || 5;
  const dailyHours = constraints.dailyHours || 3;
  const skillLevel = constraints.skillLevel || "intermediate";

  const systemInstruction = `You are Google Gemini, an elite AI productivity planner and curriculum designer.
Analyze the user's goal: "${goalText}"
Target timeline: ${requestedDays} days. Available daily time: ${dailyHours} hours/day. Skill level: ${skillLevel}.
Current reference date: ${refIso}.

Generate an authentic, high-impact, topic-specific preparation or execution plan based on their exact goal.
STRICT QUALITY RULES:
1. Every task must directly support the requested outcome with concrete subject matter (e.g., specific algorithms, topic names, syntax drills).
2. NEVER use repetitive, generic placeholders like "Define scope", "Initial execution", "Assemble tools", or "Wrap up".
3. Keep task durations realistic (between 30 to 120 minutes) and respect the daily budget of ${dailyHours} hours (${dailyHours * 60} mins total).
4. Sequence tasks logically from foundations to practice and mock testing.`;

  const prompt = `Generate a structured, non-generic ${requestedDays}-day plan for: "${goalText}".
Respond STRICTLY with valid JSON in this exact schema:
{
  "subject": "Clear, specific subject title",
  "overview": "Insightful paragraphs explaining the strategic approach and core methodology.",
  "totalDays": ${requestedDays},
  "dailyHours": ${dailyHours},
  "recommendations": [
    "Specific high-yield technique 1",
    "Specific high-yield technique 2",
    "Specific high-yield technique 3"
  ],
  "schedule": [
    {
      "dayNumber": 1,
      "date": "${refIso}",
      "dayLabel": "Day 1",
      "theme": "Day 1 specific theme",
      "items": [
        {
          "id": "task-d1-1",
          "task": "Concrete task title mentioning specific topic",
          "duration": "90 mins",
          "priority": "High",
          "dueDate": "${refIso}",
          "phase": "Foundations",
          "selected": true
        },
        {
          "id": "task-d1-2",
          "task": "Concrete practical drill or exercise",
          "duration": "60 mins",
          "priority": "Medium",
          "dueDate": "${refIso}",
          "phase": "Application",
          "selected": true
        }
      ]
    }
  ]
}`;

  const result = await callGemini({
    prompt,
    systemInstruction,
    temperature: 0.2,
    jsonMode: true,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
      provider: result.provider,
    };
  }

  const parsed = extractAndValidateJSON(result.text);
  if (!parsed || !Array.isArray(parsed.schedule) || parsed.schedule.length === 0) {
    return {
      success: false,
      error: "INVALID_OUTPUT",
      message: "Gemini returned a plan with missing or malformed schedule structure.",
      provider: result.provider,
    };
  }

  // Flatten actionable tasks for 1-click board import
  const actionableTasks = [];
  parsed.schedule.forEach((day, dIdx) => {
    (day.items || []).forEach((item, iIdx) => {
      actionableTasks.push({
        id: item.id || `gemini-task-${dIdx + 1}-${iIdx + 1}`,
        task: item.task || item.title || "Study Session",
        priority: item.priority || "Medium",
        dueDate: item.dueDate || day.date || refIso,
        duration: item.duration || "60 mins",
        theme: day.theme || "Execution",
        phase: item.phase || "Milestone Execution",
        selected: true,
      });
    });
  });

  return {
    success: true,
    goal: goalText,
    subject: parsed.subject || goalText,
    overview: parsed.overview || `A focused preparation roadmap for "${goalText}".`,
    days: parsed.schedule.length,
    totalDays: parsed.schedule.length,
    dailyHours: parsed.dailyHours || dailyHours,
    totalHours: parsed.schedule.length * (parsed.dailyHours || dailyHours),
    totalSessions: actionableTasks.length,
    schedule: parsed.schedule,
    recommendations: parsed.recommendations || [],
    actionableTasks,
    provider: result.provider,
  };
}

/**
 * Task Breakdown with Google Gemini SDK
 */
async function breakdownTaskWithGemini(taskText, priority = "Medium", dueDate = null) {
  const systemInstruction = `You are Google Gemini, an expert engineering decomposition assistant.
Break down this task into 4 to 6 logical, actionable, concrete subtasks: "${taskText}".
Priority: ${priority}, Due Date: ${dueDate || "None"}.
Rules:
- Produce project-specific, technically accurate subtasks.
- Avoid generic filler like "Define scope" or "Initial execution".
- Realistic durations (30m, 45m, 60m).`;

  const prompt = `Break down: "${taskText}".
Respond STRICTLY with a valid JSON array of objects:
[
  { "task": "Specific subtask title", "priority": "High", "duration": "45 mins", "dueDate": "${dueDate || ""}" }
]`;

  const result = await callGemini({
    prompt,
    systemInstruction,
    temperature: 0.2,
    jsonMode: true,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
      provider: result.provider,
    };
  }

  const parsed = extractAndValidateJSON(result.text);
  const list = Array.isArray(parsed) ? parsed : (parsed?.subtasks || parsed?.items);

  if (!Array.isArray(list) || list.length === 0) {
    return {
      success: false,
      error: "INVALID_OUTPUT",
      message: "Gemini returned a subtask breakdown with invalid structure.",
      provider: result.provider,
    };
  }

  const subtasks = list.map((s, idx) => ({
    id: `subtask-${Date.now()}-${idx + 1}`,
    task: s.task || s.title || "Step",
    priority: s.priority || priority,
    duration: s.duration || "45 mins",
    dueDate: s.dueDate || dueDate,
    completed: false,
  }));

  return {
    success: true,
    task: taskText,
    subtasks,
    provider: result.provider,
  };
}

/**
 * Natural Language Assistance & Intent Queries with Google Gemini SDK
 */
async function answerQueryWithGemini({
  query,
  intent,
  constraints = {},
  _history = [],
  currentTasks = [],
}) {
  let systemInstruction;

  if (intent === "programming_help") {
    systemInstruction = `You are Google Gemini, a senior software engineer and technical tutor.
Provide a clear, technically precise explanation, root-cause analysis, and working code snippet.
Format with clean markdown and syntax-highlighted code blocks.
Include brief testing steps. Never emit generic project-management templates.`;
  } else if (intent === "career_interview") {
    systemInstruction = `You are Google Gemini, an elite technical interviewer and career coach.
Provide a high-impact, role-specific interview preparation strategy.
Cover core coding patterns, system design architectures, and behavioral STAR story frameworks.
Include a realistic timeline. Never emit generic project-management templates.`;
  } else if (intent === "ambiguous") {
    systemInstruction = `You are Google Gemini. The user's query is brief or missing specific details.
Provide a warm 1-sentence acknowledgment and ask ONE concise, specific clarifying question to identify their subject, programming language, or goal.
Do not invent completed actions or hallucinate facts.`;
  } else {
    systemInstruction = `You are Google Gemini, an intelligent, context-aware productivity assistant in TaskFlow.
Answer the user's specific request directly, accurately, and thoroughly.
Use structured markdown with sections, bullet points, and code when relevant.
Do NOT force the response into a task list unless specifically asked.
Current tasks count: ${currentTasks.length}.`;
  }

  let prompt = `User Query: "${query}"`;
  if (constraints.requestedDays || constraints.dailyHours) {
    prompt += `\nConstraints: ${constraints.requestedDays || "flexible"} days, ${constraints.dailyHours || "standard"} hours daily.`;
  }

  const result = await callGemini({
    prompt,
    systemInstruction,
    temperature: 0.3,
    jsonMode: false,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
      provider: result.provider,
    };
  }

  return {
    success: true,
    answer: result.text,
    provider: result.provider,
  };
}

module.exports = {
  isGeminiConfigured,
  getGeminiApiKey,
  getGeminiModelName,
  getGeminiClient,
  callGemini,
  generatePlanWithGemini,
  breakdownTaskWithGemini,
  answerQueryWithGemini,
  extractAndValidateJSON,
  setMockGeminiProvider,
  clearMockGeminiProvider,
};
