import { useEffect, useMemo, useState } from "react";
import type { Conversation, Message } from "../../../features/conversations/types";
import { loadConversations, saveConversations } from "../../../features/conversations/storage";
import { makeNewConversation, uid } from "../../../features/conversations/helpers";
import { postChatMessage } from "../../../features/chat/api";

import Sidebar from "../../../components/sidebar/Sidebar";
import ChatPanel from "../../../components/chat/ChatPanel";


export default function ChatShellPage() {
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
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
  };

  const updateConversation = (id: string, updater: (c: Conversation) => Conversation) => {
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
      const { reply } = await postChatMessage({
        sessionId: activeConversation.sessionId,
        messageId: uid(),
        message: trimmed,
      });

      const botMsg: Message = {
        id: uid(),
        role: "asho",
        text: reply,
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

  const selectConversation = (id: string) => setActiveId(id);

  return (
    <div style={{ height: "100vh", display: "flex", background: "#f3f4f6" }}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onNewConversation={createConversation}
        onSelectConversation={selectConversation}
      />

      <ChatPanel
        conversation={activeConversation}
        input={input}
        setInput={setInput}
        isSending={isSending}
        clarifyOptions={clarifyOptions}
        onSendText={sendText}
        onSend={sendMessage}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
