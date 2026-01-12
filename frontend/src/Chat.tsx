import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { API_BASE_URL } from "./config";

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

export default function Chat() {
  const [sessionId] = useState(uuidv4());
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DebugMessage[]>([]);
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([]);

  function log(text: string) {
    setConsoleLog((prev) => [...prev, { timestamp: Date.now(), text }]);
  }

  async function sendMessage() {
    if (!input.trim()) return;

    const message_id = uuidv4();
    const payload = {
      session_id: sessionId,
      message_id,
      message: input,
    };

    log(`POST /api/chat → ${JSON.stringify(payload)}`);

    const userMsg: DebugMessage = {
      role: "user",
      text: input,
      session_id: sessionId,
      message_id,
      method: "POST /api/chat",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      log(`Response status: ${res.status}`);

      const data = await res.json();
      log(`Response body: ${JSON.stringify(data)}`);

      const assistantMsg: DebugMessage = {
        role: "assistant",
        text: String(data.reply ?? ""),
        session_id: sessionId,
        message_id: uuidv4(),
        method: "POST /api/chat",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
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
              <div
                style={{
                  fontWeight: 600,
                  color: "#000000",
                }}
              >
                {m.role.toUpperCase()}
              </div>

              <div
                style={{
                  margin: "6px 0",
                  color: "#000000",
                }}
              >
                {m.text}
              </div>

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
          flex: 1,
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
        <div style={{ overflowY: "auto", height: "85%" }}>
          {consoleLog.map((c, i) => (
            <div key={i}>
              [{new Date(c.timestamp).toLocaleTimeString()}] {c.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
