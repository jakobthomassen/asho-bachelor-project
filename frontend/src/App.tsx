import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { API_BASE_URL } from "./config";

type Role = "user" | "asho";

interface Message {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
}

interface Conversation {
  id: string;
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

const STORAGE_KEY = "asho_conversations_v2";

function uid() {
  return uuidv4();
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

function makeNewConversation(): Conversation {
  const now = Date.now();
  return {
    id: uid(),
    sessionId: uid(),
    title: "Ny samtale",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: uid(),
        role: "asho",
        text: "Hei, jeg er ASHO. Hva vil du snakke om i dag?",
        createdAt: now,
      },
    ],
  };
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const clarifyOptions = ["Kan du utdype?", "Gi et eksempel", "Oppsummer kort"];

  useEffect(() => {
    const initial = loadConversations();
    if (initial.length === 0) {
      const c = makeNewConversation();
      setConversations([c]);
      setActiveId(c.id);
      saveConversations([c]);
    } else {
      const sorted = [...initial].sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(sorted);
      setActiveId(sorted[0].id);
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations);
  }, [conversations]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId]
  );

  const createConversation = () => {
    const c = makeNewConversation();
    setConversations([c, ...conversations]);
    setActiveId(c.id);
  };

  const updateConversation = (
    id: string,
    updater: (c: Conversation) => Conversation
  ) => {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === id ? updater(c) : c));
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      return next;
    });
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !activeConversation || isSending) return;

    setIsSending(true);
    setInput("");

    const now = Date.now();
    const userMsg: Message = {
      id: uid(),
      role: "user",
      text: trimmed,
      createdAt: now,
    };

    updateConversation(activeConversation.id, (c) => ({
      ...c,
      title:
        c.messages.filter((m) => m.role === "user").length === 0
          ? trimmed.slice(0, 28)
          : c.title,
      updatedAt: now,
      messages: [...c.messages, userMsg],
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeConversation.sessionId,
          message_id: uid(),
          message: trimmed,
        }),
      });

      const data = await res.json();

      const botMsg: Message = {
        id: uid(),
        role: "asho",
        text: String(data.reply ?? ""),
        createdAt: Date.now(),
      };

      updateConversation(activeConversation.id, (c) => ({
        ...c,
        updatedAt: Date.now(),
        messages: [...c.messages, botMsg],
      }));
    } catch {
      updateConversation(activeConversation.id, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          {
            id: uid(),
            role: "asho",
            text: "Serverfeil. Prøv igjen.",
            createdAt: Date.now(),
          },
        ],
      }));
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = () => sendText(input);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
  };

  return (
    <div style={{ height: "100vh", display: "flex", background: "#f3f4f6" }}>
      <aside
        style={{
          width: 280,
          borderRight: "1px solid #e5e7eb",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>
          <div
            style={{ fontWeight: 700, fontSize: "1.1rem", color: "#0f172a" }}
          >
            ASHO
          </div>
          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 4 }}>
            Samtaler (historikk)
          </div>

          <button
            onClick={createConversation}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "0.6rem 0.8rem",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#0f766e",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            New conversation
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "0.5rem" }}>
          {conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => selectConversation(c.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.75rem",
                  borderRadius: 12,
                  border: active
                    ? "1px solid #0f766e"
                    : "1px solid transparent",
                  background: active ? "#ecfdf5" : "transparent",
                  cursor: "pointer",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: "#111827",
                    fontSize: "0.95rem",
                  }}
                >
                  {c.title || "Samtale"}
                </div>
                <div
                  style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 2 }}
                >
                  {new Date(c.updatedAt).toLocaleString()}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb" }}
        >
          <div style={{ fontWeight: 700, color: "#0f172a" }}>
            {activeConversation?.title ?? "Samtale"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 4 }}>
            Velg en samtale til venstre, eller start en ny.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
          {activeConversation?.messages.map((m) => {
            const isUser = m.role === "user";

            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  marginBottom: 12,
                }}
              >
                <div style={{ maxWidth: "70%" }}>
                  <div
                    style={{
                      padding: "0.7rem 0.9rem",
                      borderRadius: isUser
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                      background: isUser ? "#e5e7eb" : "#e0f2fe",
                      color: "#111827",
                      boxShadow: "0 4px 8px rgba(15,23,42,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#6b7280",
                        marginBottom: 2,
                      }}
                    >
                      {isUser ? "Meg" : "ASHO"}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                  </div>

                  {!isUser && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {clarifyOptions.map((label) => (
                        <button
                          key={label}
                          onClick={() => sendText(label)}
                          disabled={isSending}
                          style={{
                            padding: "0.4rem 0.65rem",
                            borderRadius: 999,
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            color: "#0f172a",
                            fontSize: "0.85rem",
                            cursor: isSending ? "not-allowed" : "pointer",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && <div style={{ color: "#6b7280" }}>ASHO skriver…</div>}
        </div>

        <div
          style={{
            padding: "0.9rem 1.25rem",
            borderTop: "1px solid #e5e7eb",
            background: "#ffffff",
            display: "flex",
            gap: 10,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Skriv en melding…'
            style={{
              flex: 1,
              padding: "0.7rem 1rem",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              outline: "none",
              fontSize: "1rem",
              color: "#111827",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending || !activeConversation}
            style={{
              padding: "0.7rem 1.1rem",
              borderRadius: 999,
              border: "none",
              background: !input.trim() || isSending ? "#e5e7eb" : "#0f766e",
              color: !input.trim() || isSending ? "#9ca3af" : "#ffffff",
              fontWeight: 700,
              cursor: !input.trim() || isSending ? "not-allowed" : "pointer",
            }}
          >
            Send
          </button>
        </div>
      </main>
    </div>
  );
}
