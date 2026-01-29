import type { Conversation } from "./types";

const STORAGE_KEY = "asho_conversations_cache_v1";

function keyFor(userId: string) {
  return `${STORAGE_KEY}:${userId}`;
}

export function loadConversations(userId: string | null): Conversation[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

export function saveConversations(userId: string | null, convos: Conversation[]) {
  if (!userId) return;
  localStorage.setItem(keyFor(userId), JSON.stringify(convos));
}
