import { v4 as uuidv4 } from "uuid";
import type { Conversation, Message } from "./types";

export function uid() {
  return uuidv4();
}

export function makeNewConversation(): Conversation {
  const now = Date.now();

  const first: Message = {
    id: uid(),
    role: "asho",
    text: "Hei, jeg er ASHO. Hva vil du snakke om i dag?",
    createdAt: now,
  };

  return {
    id: uid(),
    sessionId: uid(),
    title: "Ny samtale",
    createdAt: now,
    updatedAt: now,
    messages: [first],
  };
}
