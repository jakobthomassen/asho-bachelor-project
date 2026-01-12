import React, { useEffect, useMemo, useState } from "react";
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
  title: string;
  createdAt: number;
  updatedAt: number;
  sessionId: string;
  messages: Message[];
}

const STORAGE_KEY = "asho_conversations_v2";

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
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
    id: uuidv4(),
    sessionId: uuidv4(),
    title: "Ny samtale",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: uuidv4(),
        role: "asho",
        text: "Hei, jeg er ASHO. Hva vil du snakke om i dag?",
        createdAt: now,
      },
    ],
  };
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const initial = loadConversations();
    if (initial.length === 0) {
      const c = makeNewConversation();
      setConversations([c]);
      setActiveId(c.id);
    } else {
      setConversations(initial.sort((a, b) => b.updatedAt - a.updatedAt));
      setActiveId(initial[0].id);
    }
  }, []);

  useEffect(() => {
    if (conversations.length) saveConversations(conversations);
  }, [conversations]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId]
  );

  function updateConversation(
    id: string,
    fn: (c: Conversation) => Conversation
  ) {
    setConversations((prev) =>
      prev
        .map((c) => (c.id === id ? fn(c) : c))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    );
  }

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !activeConversation || isSending) return;

    setIsSending(true);
    setInput("");

    const now = Date.now();
    const userMsg: Message = {
      id: uuidv4(),
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
          message_id: uuidv4(),
          message: trimmed,
        }),
      });

      const data = await res.json();

      const botMsg: Message = {
        id: uuidv4(),
        role: "asho",
        text: String(data.reply ?? ""),
        createdAt: Date.now(),
      };

      updateConversation(activeConversation.id, (c) => ({
        ...c,
        updatedAt: Date.now(),
        messages: [...c.messages, botMsg],
      }));
    } catch (err) {
      updateConversation(activeConversation.id, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          {
            id: uuidv4(),
            role: "asho",
            text: "Feil ved tilkobling til server.",
            createdAt: Date.now(),
          },
        ],
      }));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div style={{ height: "100vh", display: "flex" }}>
      <aside style={{ width: 260, borderRight: "1px solid #ddd" }}>
        <button
          onClick={() => {
            const c = makeNewConversation();
            setConversations([c, ...conversations]);
            setActiveId(c.id);
          }}
        >
          New conversation
        </button>

        {conversations.map((c) => (
          <div key={c.id} onClick={() => setActiveId(c.id)}>
            {c.title}
          </div>
        ))}
      </aside>

      <main style={{ flex: 1, padding: 16 }}>
        <div style={{ minHeight: 400 }}>
          {activeConversation?.messages.map((m) => (
            <div key={m.id}>
              <b>{m.role}:</b> {m.text}
            </div>
          ))}
          {isSending && <div>ASHO skriver…</div>}
        </div>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText(input)}
        />
        <button onClick={() => sendText(input)} disabled={isSending}>
          Send
        </button>
      </main>
    </div>
  );
}
