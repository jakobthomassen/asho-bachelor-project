import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { API_BASE_URL } from "./config";
import { useAuth } from "./app/AuthProvider";

type DebugMessage = {
  role: "user" | "assistant";
  text: string;
  session_id: string;
  message_id: string;
  method: string;
  timestamp: number;
};

type ConsoleEntry = {
  timestamp: number;
  text: string;
};

type PromptTrace = {
  stage?: string;
  prompt_tokens?: number | null;
  created_at?: number;
  messages: Array<{ role: string; content: string }>;
  response_text?: string | null;
  response_json?: unknown;
};

type DebugChatResponse = {
  reply?: string;
  last_prompt_tokens?: number | null;
  conversation_tokens?: number | null;
  classification?: {
    method?: string;
    event?: string;
    route_mode?: string;
    selected_topic_key?: string | null;
    candidate_topic_key?: string | null;
    confidence?: number | null;
    reason?: string | null;
  } | null;
};

const STAGE_COLORS: Record<string, string> = {
  chat: "#4ade80",
  classifier: "#f59e0b",
  summary: "#a78bfa",
  title: "#38bdf8",
};

function stageColor(stage: string | undefined) {
  return STAGE_COLORS[stage ?? ""] ?? "#94a3b8";
}

export default function Chat() {
  const { sessionToken } = useAuth();
  const [sessionId] = useState(uuidv4());
  const [conversationId] = useState(uuidv4());
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DebugMessage[]>([]);
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([]);
  const [promptTraces, setPromptTraces] = useState<PromptTrace[]>([]);
  const [lastPromptTokens, setLastPromptTokens] = useState<number | null>(null);
  const [conversationTokens, setConversationTokens] = useState<number | null>(null);
  const [classification, setClassification] = useState<DebugChatResponse["classification"]>(null);
  const streamRef = useRef<{ cancelled: boolean } | null>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.cancelled = true;
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLog]);

  function log(text: string) {
    setConsoleLog((prev) => [...prev, { timestamp: Date.now(), text }]);
  }

  const updateMessageText = (messageId: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.message_id === messageId ? { ...m, text } : m))
    );
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const streamAssistantReply = async (messageId: string, fullText: string) => {
    if (!fullText) return;
    const token = { cancelled: false };
    if (streamRef.current) streamRef.current.cancelled = true;
    streamRef.current = token;

    let i = 0;
    while (i < fullText.length) {
      if (token.cancelled) return;
      const chunkSize =
        fullText.length > 400 ? 12 : fullText.length > 200 ? 8 : 4;
      i = Math.min(fullText.length, i + chunkSize);
      updateMessageText(messageId, fullText.slice(0, i));
      const jitter = Math.floor(Math.random() * 12);
      await sleep(8 + jitter);
    }
  };

  async function fetchPromptTraces() {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/prompt-trace/${sessionId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        log(`Prompt trace fetch failed: ${res.status}`);
        return;
      }
      const data = await res.json();
      const raw = Array.isArray(data.traces) ? data.traces : [];
      const mapped: PromptTrace[] = raw.map((t: any) => {
        if (Array.isArray(t)) {
          return { stage: "chat", prompt_tokens: null, created_at: undefined, messages: t };
        }
        return {
          stage: typeof t?.stage === "string" ? t.stage : "chat",
          prompt_tokens:
            typeof t?.prompt_tokens === "number" ? t.prompt_tokens : null,
          created_at: typeof t?.created_at === "number" ? t.created_at : undefined,
          messages: Array.isArray(t?.messages) ? t.messages : [],
          response_text: typeof t?.response_text === "string" ? t.response_text : null,
          response_json: t?.response_json ?? null,
        };
      });
      setPromptTraces(mapped);
    } catch {
      log("Failed to fetch prompt traces");
    }
  }

  async function sendMessage() {
    if (!input.trim()) return;
    if (!sessionToken) {
      log("Missing session token; log in first");
      return;
    }

    const message_id = uuidv4();
    const payload = {
      conversation_id: conversationId,
      session_id: sessionId,
      message_id,
      message: input,
    };

    log(`POST /api/chat → ${JSON.stringify(payload)}`);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: input,
        session_id: sessionId,
        message_id,
        method: "POST /api/chat",
        timestamp: Date.now(),
      },
    ]);

    setInput("");

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers.Authorization = `Bearer ${sessionToken}`;
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      log(`Response status: ${res.status}`);

      const data = (await res.json()) as DebugChatResponse;
      log(`Response body: ${JSON.stringify(data)}`);
      setLastPromptTokens(
        typeof data.last_prompt_tokens === "number" ? data.last_prompt_tokens : null
      );
      setConversationTokens(
        typeof data.conversation_tokens === "number" ? data.conversation_tokens : null
      );
      setClassification(data.classification ?? null);

      const assistantId = uuidv4();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "",
          session_id: sessionId,
          message_id: assistantId,
          method: "POST /api/chat",
          timestamp: Date.now(),
        },
      ]);

      const replyText = String(data.reply ?? "");
      await streamAssistantReply(assistantId, replyText);
      updateMessageText(assistantId, replyText);

      await fetchPromptTraces();
    } catch (err) {
      log(`ERROR: ${String(err)}`);
    }
  }

  return (
    <div style={styles.root}>
      {/* ── Chat Trace ── */}
      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Chat Trace</h2>

        <div style={styles.chatMessages}>
          {messages.length === 0 && (
            <p style={styles.emptyHint}>No messages yet. Send something below.</p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                ...styles.chatBubble,
                background: m.role === "user" ? "#1e293b" : "#0f2d40",
                borderLeft: `3px solid ${m.role === "user" ? "#64748b" : "#38bdf8"}`,
              }}
            >
              <div style={{ ...styles.bubbleRole, color: m.role === "user" ? "#94a3b8" : "#38bdf8" }}>
                {m.role.toUpperCase()}
              </div>
              <div style={styles.bubbleText}>{m.text}</div>
              <div style={styles.bubbleMeta}>
                <span>session: {m.session_id.slice(0, 8)}…</span>
                <span>msg: {m.message_id.slice(0, 8)}…</span>
                <span>{m.method}</span>
                <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.inputRow}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type debug message and press Enter"
            style={styles.input}
          />
          <button onClick={sendMessage} style={styles.sendBtn}>Send</button>
        </div>
      </section>

      {/* ── Right column: Console + Classification ── */}
      <div style={styles.rightColumn}>
        {/* Classification */}
        <section style={{ ...styles.panel, ...styles.classificationPanel }}>
          <h2 style={styles.panelTitle}>Classification</h2>
          <div style={styles.classGrid}>
            <ClassRow label="method" value={classification?.method} />
            <ClassRow label="event" value={classification?.event} />
            <ClassRow label="route_mode" value={classification?.route_mode} />
            <ClassRow label="selected_topic" value={classification?.selected_topic_key ?? "default"} />
            <ClassRow label="candidate_topic" value={classification?.candidate_topic_key} />
            <ClassRow
              label="confidence"
              value={
                typeof classification?.confidence === "number"
                  ? classification.confidence.toFixed(4)
                  : undefined
              }
            />
            <ClassRow label="reason" value={classification?.reason} span />
            <ClassRow label="last_prompt_tokens" value={lastPromptTokens?.toString()} />
            <ClassRow label="conversation_tokens" value={conversationTokens?.toString()} />
            <ClassRow label="pipeline_calls" value={promptTraces.length.toString()} />
          </div>
        </section>

        {/* Console */}
        <section style={{ ...styles.panel, ...styles.consolePanel }}>
          <h2 style={{ ...styles.panelTitle, color: "#93c5fd" }}>Console</h2>
          <div style={styles.consoleLog}>
            {consoleLog.map((c, i) => (
              <div key={i} style={styles.consoleLine}>
                <span style={styles.consoleTime}>[{new Date(c.timestamp).toLocaleTimeString()}]</span>
                {" "}{c.text}
              </div>
            ))}
            <div ref={consoleBottomRef} />
          </div>
        </section>
      </div>

      {/* ── LLM API Calls ── */}
      <section style={{ ...styles.panel, ...styles.tracePanel }}>
        <h2 style={{ ...styles.panelTitle, color: "#38bdf8" }}>
          LLM API Calls
          {promptTraces.length > 0 && (
            <span style={styles.traceBadge}>{promptTraces.length}</span>
          )}
        </h2>
        <div style={styles.traceScroll}>
          {promptTraces.length === 0 && (
            <p style={styles.emptyHint}>No traces yet. Send a message to populate.</p>
          )}
          {promptTraces.map((t, i) => (
            <div key={i} style={styles.traceCall}>
              {/* Call header */}
              <div style={{ ...styles.traceHeader, borderColor: stageColor(t.stage) }}>
                <span style={{ ...styles.traceStageTag, background: stageColor(t.stage) }}>
                  {(t.stage ?? "chat").toUpperCase()}
                </span>
                <span style={styles.traceCallNum}>Call #{i + 1}</span>
                {t.prompt_tokens != null && (
                  <span style={styles.traceMeta}>{t.prompt_tokens} tokens</span>
                )}
                {t.created_at && (
                  <span style={styles.traceMeta}>
                    {new Date(t.created_at * 1000).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {/* Messages */}
              <div style={styles.traceMessages}>
                {t.messages.map((msg, j) => (
                  <div key={j} style={styles.traceMsg}>
                    <div
                      style={{
                        ...styles.traceMsgRole,
                        color:
                          msg.role === "system"
                            ? "#f59e0b"
                            : msg.role === "assistant"
                            ? "#4ade80"
                            : "#94a3b8",
                      }}
                    >
                      [{msg.role.toUpperCase()}]
                    </div>
                    <pre style={styles.traceMsgContent}>{msg.content}</pre>
                  </div>
                ))}
              </div>

              {/* Response */}
              <div style={styles.traceResponseHeader}>RESPONSE</div>
              <pre style={styles.traceResponse}>
                {t.response_json
                  ? JSON.stringify(t.response_json, null, 2)
                  : String(t.response_text ?? "n/a")}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClassRow({
  label,
  value,
  span,
}: {
  label: string;
  value?: string | null;
  span?: boolean;
}) {
  return (
    <>
      <span style={styles.classLabel}>{label}</span>
      <span style={{ ...styles.classValue, ...(span ? { gridColumn: "2 / -1" } : {}) }}>
        {value ?? <span style={{ color: "#475569" }}>n/a</span>}
      </span>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "grid",
    gridTemplateColumns: "minmax(300px, 2fr) minmax(220px, 1.1fr) minmax(340px, 2.4fr)",
    gridTemplateRows: "1fr",
    gap: 12,
    height: "calc(100vh - 56px)",
    padding: "12px 20px",
    boxSizing: "border-box",
    background: "#020617",
    color: "#e2e8f0",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 13,
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: "12px 14px",
    overflow: "hidden",
    minHeight: 0,
  },
  panelTitle: {
    margin: "0 0 10px 0",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  // Chat
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 0,
  },
  chatBubble: {
    borderRadius: 8,
    padding: "8px 10px",
    flexShrink: 0,
  },
  bubbleRole: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    marginBottom: 4,
  },
  bubbleText: {
    color: "#e2e8f0",
    lineHeight: 1.5,
    marginBottom: 6,
  },
  bubbleMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 12px",
    fontSize: 10,
    color: "#475569",
    fontFamily: "monospace",
  },
  inputRow: {
    display: "flex",
    gap: 8,
    marginTop: 10,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
  },
  sendBtn: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  emptyHint: {
    color: "#334155",
    fontStyle: "italic",
    margin: "auto",
    textAlign: "center",
  },
  // Right column
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 0,
    overflow: "hidden",
  },
  classificationPanel: {
    flexShrink: 0,
  },
  classGrid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "4px 10px",
    alignItems: "start",
  },
  classLabel: {
    color: "#64748b",
    fontSize: 11,
    fontFamily: "monospace",
    whiteSpace: "nowrap",
    paddingTop: 1,
  },
  classValue: {
    color: "#cbd5e1",
    fontSize: 12,
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  // Console
  consolePanel: {
    flex: 1,
    background: "#020617",
    border: "1px solid #0f172a",
    minHeight: 0,
  },
  consoleLog: {
    flex: 1,
    overflowY: "auto",
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 1.6,
    color: "#64748b",
    minHeight: 0,
  },
  consoleLine: {
    borderBottom: "1px solid #0f172a",
    padding: "2px 0",
    wordBreak: "break-all",
  },
  consoleTime: {
    color: "#334155",
  },
  // Trace panel
  tracePanel: {
    minHeight: 0,
  },
  traceBadge: {
    background: "#1e3a5f",
    color: "#38bdf8",
    borderRadius: 10,
    padding: "1px 7px",
    fontSize: 11,
    fontWeight: 700,
  },
  traceScroll: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minHeight: 0,
    paddingRight: 2,
  },
  traceCall: {
    border: "1px solid #1e293b",
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
  },
  traceHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    background: "#0b1628",
    borderBottom: "2px solid",
  },
  traceStageTag: {
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: 10,
    fontWeight: 700,
    color: "#000",
    letterSpacing: "0.05em",
  },
  traceCallNum: {
    color: "#94a3b8",
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: 600,
  },
  traceMeta: {
    color: "#475569",
    fontFamily: "monospace",
    fontSize: 11,
  },
  traceMessages: {
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "#080f1e",
  },
  traceMsg: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  traceMsgRole: {
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "monospace",
    letterSpacing: "0.06em",
  },
  traceMsgContent: {
    margin: 0,
    fontFamily: "monospace",
    fontSize: 11,
    color: "#cbd5e1",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: "#0f1a2e",
    borderRadius: 4,
    padding: "5px 8px",
    borderLeft: "2px solid #1e293b",
  },
  traceResponseHeader: {
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "monospace",
    letterSpacing: "0.06em",
    color: "#4ade80",
    padding: "5px 10px 2px",
    background: "#080f1e",
  },
  traceResponse: {
    margin: 0,
    fontFamily: "monospace",
    fontSize: 11,
    color: "#a7f3d0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: "#061810",
    padding: "6px 10px 10px",
    borderTop: "1px solid #0f2d1e",
  },
};
