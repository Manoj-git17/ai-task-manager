import { useState, useRef, useEffect } from "react";
import {
  FiSend,
  FiX,
  FiTrash2,
  FiPlus,
  FiCheck,
  FiClock,
  FiFlag,
  FiMinimize2,
  FiMaximize2,
  FiRefreshCw,
  FiLayers,
} from "react-icons/fi";
import { toast } from "react-toastify";
import TaskFlowSymbol from "./TaskFlowSymbol";

let globalMsgCounter = 0;
function createMsgId(prefix = "msg") {
  globalMsgCounter += 1;
  return `${prefix}-${globalMsgCounter}`;
}

function getFormattedTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function AiChatAssistant({
  isOpen,
  onClose,
  tasks = [],
  onAddTask,
  activeWorkspace = "Engineering Core",
  injectedInteraction = null,
}) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("tf_ai_chat_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse saved chat history:", e);
    }
    return [
      {
        id: "msg-welcome",
        role: "assistant",
        content: `👋 Hello! I am your **Taskflow agent** (powered by Gemini AI).\n\nI can help you build **mastery strategies**, prioritize your daily work, break down complex topics (like DBMS, DSA, or Python), and automatically create structured tasks for your board.\n\nWhat would you like to plan or strategize today?`,
        suggestedTasks: [],
        timestamp: getFormattedTime(),
        provider: "Taskflow agent",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [addedTaskKeys, setAddedTaskKeys] = useState(new Set());
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const API_URL = (
    import.meta.env.VITE_API_URL || "http://localhost:5000/api"
  ).replace(/\/+$/, "");

  // Persist conversation
  useEffect(() => {
    try {
      localStorage.setItem("tf_ai_chat_history", JSON.stringify(messages));
    } catch {
      // quota or silent ignore
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Handle external query injections from Hero bar or Command Console
  useEffect(() => {
    if (!injectedInteraction || !injectedInteraction.id) return;
    const { userQuery, replyText, suggestedTasks = [], provider } = injectedInteraction;

    setMessages((prev) => {
      if (prev.some((m) => m.injectedId === injectedInteraction.id)) {
        return prev;
      }
      const userMsg = {
        id: createMsgId("user"),
        injectedId: injectedInteraction.id,
        role: "user",
        content: userQuery,
        timestamp: getFormattedTime(),
      };
      const botMsg = {
        id: createMsgId("bot"),
        role: "assistant",
        content: replyText,
        suggestedTasks: Array.isArray(suggestedTasks) ? suggestedTasks : [],
        timestamp: getFormattedTime(),
        provider: provider || "TaskFlow AI (Live)",
      };
      return [...prev, userMsg, botMsg];
    });
  }, [injectedInteraction]);

  const QUICK_PROMPTS = [
    "Give me a 3-day strategy for my DBMS exam",
    "What should I focus on first from my current tasks?",
    "Step-by-step preparation plan for DSA coding interviews",
    "How to learn Python in 7 days with daily tasks",
  ];

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsgId = createMsgId("user");
    const userMsg = {
      id: userMsgId,
      role: "user",
      content: query,
      timestamp: getFormattedTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: query,
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentTasks: tasks.map((t) => ({
            task: t.task || t.title,
            priority: t.priority,
            dueDate: t.dueDate,
            completed: t.completed,
          })),
          referenceDate: new Date().toISOString(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to get AI response.");
      }

      const botMsgId = createMsgId("bot");
      const botMsg = {
        id: botMsgId,
        role: "assistant",
        content: data.reply || "Here is your recommended strategy and roadmap.",
        suggestedTasks: Array.isArray(data.suggestedTasks) ? data.suggestedTasks : [],
        timestamp: getFormattedTime(),
        provider: data.provider || "ChatGPT (GPT-4o Live)",
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("AI Chat error:", err);
      const errMsg = {
        id: createMsgId("err"),
        role: "assistant",
        content: `⚠️ ${err.message || "Unable to reach AI right now. Please verify your connection."}`,
        suggestedTasks: [],
        timestamp: getFormattedTime(),
        provider: "System Notice",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuggestedTask = async (taskObj, taskKey) => {
    if (addedTaskKeys.has(taskKey)) return;

    if (onAddTask) {
      try {
        await onAddTask({
          task: taskObj.task,
          priority: taskObj.priority || "Medium",
          dueDate: taskObj.dueDate || null,
          workspace: activeWorkspace || "Engineering Core",
        });
        setAddedTaskKeys((prev) => new Set([...prev, taskKey]));
        toast.success(`✨ Added "${taskObj.task}" to your board!`);
      } catch (err) {
        toast.error("Failed to add task: " + err.message);
      }
    }
  };

  const handleAddAllTasks = async (taskList) => {
    if (!Array.isArray(taskList) || taskList.length === 0) return;
    for (let i = 0; i < taskList.length; i++) {
      const t = taskList[i];
      const key = `${t.task}-${i}`;
      if (!addedTaskKeys.has(key)) {
        await handleAddSuggestedTask(t, key);
      }
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Clear conversation history?")) {
      const reset = [
        {
          id: "msg-welcome",
          role: "assistant",
          content: `👋 Chat cleared! Ask me anything — from exam preparation to daily task prioritization.`,
          suggestedTasks: [],
          timestamp: getFormattedTime(),
          provider: "Taskflow agent",
        },
      ];
      setMessages(reset);
      setAddedTaskKeys(new Set());
      localStorage.removeItem("tf_ai_chat_history");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`tf-chat-drawer-container ${isExpanded ? "expanded" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Taskflow agent"
    >
      <div className="tf-chat-backdrop" onClick={onClose} />

      <div className="tf-chat-drawer-panel">
        {/* Header */}
        <div className="tf-chat-header">
          <div className="tf-chat-header-brand">
            <div className="tf-chat-logo-bubble">
              <TaskFlowSymbol size={20} fill="#ffffff" glow />
            </div>
            <div className="tf-chat-title-group">
              <div className="tf-chat-title-row">
                <span className="tf-chat-title">Taskflow agent</span>
                <span className="tf-chat-badge-live">
                  <span className="tf-live-dot" />
                  <span>Taskflow agent (Live)</span>
                </span>
              </div>
              <span className="tf-chat-subtitle">
                Interactive Strategy, Problem Solving & Smart Plans
              </span>
            </div>
          </div>

          <div className="tf-chat-header-actions">
            <button
              type="button"
              className="tf-chat-tool-btn"
              onClick={handleClearChat}
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <FiTrash2 />
            </button>
            <button
              type="button"
              className="tf-chat-tool-btn"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? "Standard view" : "Expand view"}
              aria-label="Toggle size"
            >
              {isExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
            </button>
            <button
              type="button"
              className="tf-chat-tool-btn close-btn"
              onClick={onClose}
              title="Close chat"
              aria-label="Close chat"
            >
              <FiX />
            </button>
          </div>
        </div>

        {/* Quick Prompts Strip */}
        <div className="tf-chat-quick-prompts">
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="tf-chat-quick-chip"
              onClick={() => handleSendMessage(p)}
              disabled={loading}
            >
              <span>✦</span>
              <span>{p}</span>
            </button>
          ))}
        </div>

        {/* Message Thread */}
        <div className="tf-chat-messages">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`tf-chat-msg-row ${isUser ? "user-row" : "assistant-row"}`}
              >
                {!isUser && (
                  <div className="tf-msg-avatar">
                    <TaskFlowSymbol size={16} fill="#ffffff" />
                  </div>
                )}

                <div className="tf-msg-bubble-wrap">
                  <div className={`tf-msg-bubble ${isUser ? "user-bubble" : "assistant-bubble"}`}>
                    <div className="tf-msg-text-content">
                      {msg.content.split("\n\n").map((para, pIdx) => {
                        // Render bullet lists or headers cleanly
                        if (para.startsWith("### ") || para.startsWith("## ")) {
                          return (
                            <h4 key={pIdx} className="tf-chat-heading">
                              {para.replace(/^#+\s*/, "")}
                            </h4>
                          );
                        }
                        if (para.includes("\n- ") || para.includes("\n* ") || para.startsWith("- ") || para.startsWith("* ")) {
                          const items = para.split(/\n[-*]\s+/).filter(Boolean);
                          return (
                            <ul key={pIdx} className="tf-chat-bullet-list">
                              {items.map((it, iIdx) => (
                                <li key={iIdx}>
                                  {it.split("**").map((chunk, cIdx) =>
                                    cIdx % 2 === 1 ? <strong key={cIdx}>{chunk}</strong> : chunk
                                  )}
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        return (
                          <p key={pIdx} className="tf-chat-paragraph">
                            {para.split("**").map((chunk, cIdx) =>
                              cIdx % 2 === 1 ? <strong key={cIdx}>{chunk}</strong> : chunk
                            )}
                          </p>
                        );
                      })}
                    </div>

                    {/* Actionable Suggested Tasks Card */}
                    {Array.isArray(msg.suggestedTasks) && msg.suggestedTasks.length > 0 && (
                      <div className="tf-chat-suggested-tasks-box">
                        <div className="tf-suggested-header">
                          <span className="tf-suggested-label">
                            <FiLayers /> Suggested Action Items
                          </span>
                          <button
                            type="button"
                            className="tf-btn-add-all-suggested"
                            onClick={() => handleAddAllTasks(msg.suggestedTasks)}
                          >
                            Add All ({msg.suggestedTasks.length})
                          </button>
                        </div>

                        <div className="tf-suggested-list">
                          {msg.suggestedTasks.map((st, sIdx) => {
                            const taskKey = `${st.task}-${sIdx}`;
                            const isAdded = addedTaskKeys.has(taskKey);

                            return (
                              <div key={sIdx} className="tf-suggested-item">
                                <div className="tf-suggested-item-info">
                                  <span className="tf-suggested-task-name">{st.task}</span>
                                  <div className="tf-suggested-tags">
                                    <span
                                      className={`tf-tag-priority pri-${(
                                        st.priority || "Medium"
                                      ).toLowerCase()}`}
                                    >
                                      <FiFlag /> {st.priority || "Medium"}
                                    </span>
                                    {st.dueDate && (
                                      <span className="tf-tag-due">
                                        <FiClock /> {st.dueDate}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className={`tf-btn-add-suggested ${isAdded ? "added" : ""}`}
                                  onClick={() => handleAddSuggestedTask(st, taskKey)}
                                  disabled={isAdded}
                                >
                                  {isAdded ? (
                                    <>
                                      <FiCheck /> Added
                                    </>
                                  ) : (
                                    <>
                                      <FiPlus /> Add
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="tf-msg-footer">
                      <span className="tf-msg-time">{msg.timestamp}</span>
                      {msg.provider && <span className="tf-msg-provider">{msg.provider}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="tf-chat-msg-row assistant-row loading-row">
              <div className="tf-msg-avatar">
                <TaskFlowSymbol size={16} fill="#ffffff" />
              </div>
              <div className="tf-msg-bubble assistant-bubble typing-bubble">
                <span className="tf-typing-dot" />
                <span className="tf-typing-dot" />
                <span className="tf-typing-dot" />
                <span className="tf-typing-label">Taskflow agent is analyzing & generating strategy...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          className="tf-chat-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="tf-chat-text-input"
            placeholder="Ask Taskflow agent anything... (e.g. 'Give me best strategy for my DBMS exam in 3 days')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />

          <button
            type="submit"
            className="tf-chat-send-btn"
            disabled={loading || !input.trim()}
            title="Send to AI (Enter)"
            aria-label="Send message"
          >
            {loading ? <FiRefreshCw className="spin" /> : <FiSend />}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AiChatAssistant;
