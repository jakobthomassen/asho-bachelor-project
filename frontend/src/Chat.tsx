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
};

type DebugChatResponse = {
  reply?: string;
  last_prompt_tokens?: number | null;
  conversation_tokens?: number | null;
};

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
  const streamRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.cancelled = true;
        streamRef.current = null;
      }
    };
  }, []);

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
    try {
      const res = await fetch(`${API_BASE_URL}/api/prompt-trace/${sessionId}`);
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
    <div
      style={{ display: "flex", height: "90vh", padding: "20px 40px", gap: 16 }}
    >
      {/* Chat Trace */}
      <div
        style={{
          flex: 2,
          border: "1px solid #d1d5db",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div style={{ overflowY: "auto", height: "75%" }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 10,
                background: m.role === "user" ? "#f3f4f6" : "#e0f2fe",
              }}
            >
              <div style={{ fontWeight: 600, color: "#000" }}>
                {m.role.toUpperCase()}
              </div>
              <div style={{ margin: "6px 0", color: "#000" }}>{m.text}</div>
              <div style={{ fontSize: 12, color: "#4b5563" }}>
                session_id: {m.session_id}
                <br />
                message_id: {m.message_id}
                <br />
                method: {m.method}
                <br />
                timestamp: {new Date(m.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder='Type debug message'
          style={{
            width: "100%",
            boxSizing: "border-box",
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #9ca3af",
          }}
        />
      </div>

      {/* Console */}
      <div
        style={{
          flex: 1.1,
          border: "1px solid #111827",
          borderRadius: 12,
          padding: 12,
          background: "#020617",
          color: "#e5e7eb",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        <h3 style={{ color: "#93c5fd" }}>Console</h3>
        <div
          style={{
            marginBottom: 10,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#0b1220",
            color: "#cbd5e1",
          }}
        >
          <div>last prompt tokens: {lastPromptTokens ?? "n/a"}</div>
          <div>conversation tokens: {conversationTokens ?? "n/a"}</div>
          <div>pipeline prompts: {promptTraces.length}</div>
        </div>
        <div style={{ overflowY: "auto", height: "85%" }}>
          {consoleLog.map((c, i) => (
            <div key={i}>
              [{new Date(c.timestamp).toLocaleTimeString()}] {c.text}
            </div>
          ))}
        </div>
      </div>

      {/* Prompt Payloads */}
      <div
        style={{
          flex: 1.2,
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 12,
          background: "#020617",
          color: "#e5e7eb",
          fontFamily: "monospace",
          fontSize: 11,
        }}
      >
        <h3 style={{ color: "#38bdf8" }}>LLM Prompt Payloads</h3>
        <div style={{ overflowY: "auto", height: "85%" }}>
          {promptTraces.map((t, i) => (
            <div key={i} style={{ marginBottom: 12, borderBottom: "1px solid #1e293b", paddingBottom: 8 }}>
              <div style={{ marginBottom: 4, color: "#93c5fd" }}>
                #{i + 1} stage={t.stage ?? "chat"} prompt_tokens={t.prompt_tokens ?? "n/a"}
                {t.created_at ? ` at ${new Date(t.created_at).toLocaleTimeString()}` : ""}
              </div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(t.messages, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
