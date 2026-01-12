import type { Conversation, Message } from "./types";

export function uid(prefix = "") {
  return `${prefix}${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function makeNewConversation(): Conversation {
  const now = Date.now();
  const first: Message = {
    id: uid("m_"),
    role: "asho",
    text: "Hei, jeg er ASHO. Hva vil du snakke om i dag?",
    createdAt: now,
  };

  return {
    id: uid("c_"),
    title: "Ny samtale",
    createdAt: now,
    updatedAt: now,
    messages: [first],
  };
}
