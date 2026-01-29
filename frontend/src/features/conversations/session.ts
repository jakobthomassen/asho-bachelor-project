import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "asho_conversation_sessions_v1";

type SessionMap = Record<string, string>;

function loadMap(): SessionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SessionMap;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function saveMap(map: SessionMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getSessionIdForConversation(conversationId: string): string {
  const map = loadMap();
  const existing = map[conversationId];
  if (existing) return existing;
  const next = uuidv4();
  map[conversationId] = next;
  saveMap(map);
  return next;
}

export function removeSessionIdForConversation(conversationId: string) {
  const map = loadMap();
  if (!(conversationId in map)) return;
  delete map[conversationId];
  saveMap(map);
}
