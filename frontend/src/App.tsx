import React, { useState } from "react";

interface Message {
  id: string;
  sender: "user" | "asho";
  text: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "asho",
      text: "Hei, jeg er ASHO Hva vil du snakke om i dag?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setInput("");

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);

    const reply: Message = {
      id: `asho-${Date.now()}`,
      sender: "asho",
      text: `Jeg hører deg. Du skrev: "${trimmed}". Senere vil jeg kunne svare mer presist ut fra dialogfilene 😊`,
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, reply]);
      setIsSending(false);
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        display: "flex",
        justifyContent: "center",
        padding: "2rem 1rem",
        boxSizing: "border-box",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header style={{ marginBottom: "1.5rem" }}>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 600,
              margin: 0,
              color: "#0f172a",
            }}
          >
            ASHO
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#4b5563", fontSize: "0.95rem" }}>
            Tidlig prototype denne siden er kun for dialogen med ASHO.
          </p>
        </header>

        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            marginBottom: "1rem",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: "0.5rem",
              paddingBottom: "0.5rem",
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "75%",
                      padding: "0.6rem 0.9rem",
                      borderRadius: isUser
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                      background: isUser ? "#e5e7eb" : "#e0f2fe",
                      color: "#111827",
                      fontSize: "0.95rem",
                      boxShadow: "0 4px 8px rgba(15,23,42,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "#6b7280",
                        marginBottom: "0.2rem",
                      }}
                    >
                      {isUser ? "Meg" : "ASHO"}
                    </div>
                    <div>{msg.text}</div>
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div style={{ color: "#6b7280", fontStyle: "italic" }}>
                ASHO skriver …
              </div>
            )}
          </div>
        </main>

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid #e5e7eb",
            background: "rgba(243,244,246,0.9)",
            backdropFilter: "blur(6px)",
          }}
        >
          <input
            type="text"
            placeholder="Skriv en melding…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              padding: "0.6rem 1rem",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              fontSize: "0.95rem",
              outline: "none",
              background: "#ffffff",
              color: "#111827",

            }}
          />
          <button
            onClick={sendMessage}
            disabled={isSending || !input.trim()}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: 999,
              border: "none",
              fontSize: "0.95rem",
              fontWeight: 500,
              cursor: !input.trim() ? "not-allowed" : "pointer",
              background: !input.trim() ? "#e5e7eb" : "#0f766e",
              color: !input.trim() ? "#9ca3af" : "#ecfdf5",
              transition: "background 0.15s ease",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
