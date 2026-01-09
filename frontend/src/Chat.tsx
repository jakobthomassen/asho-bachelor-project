import { v4 as uuidv4 } from "uuid";
import { useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export default function Chat() {
  const [sessionId] = useState(uuidv4());
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const res = await fetch("http://127.0.0.1:8000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        message: userMsg.text,
      }),
    });

    const data = await res.json();
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: String(data.reply) },
    ]);
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto" }}>
      <h2>Chat</h2>

      <div style={{ minHeight: 300, border: "1px solid #ccc", padding: 10 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <b>{m.role}:</b> {m.text}
          </div>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        placeholder='Type a message'
        style={{ width: "100%", marginTop: 10 }}
      />
    </div>
  );
}
