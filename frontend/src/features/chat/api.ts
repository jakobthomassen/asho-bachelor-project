import { API_BASE_URL } from "../../config";
import { v4 as uuidv4 } from "uuid";

/**
 * Parameters required to send a chat message to the backend.
 *
 * conversationId → durable conversation identifier (maps to backend conversation_id)
 * sessionId     → ephemeral client/session identifier
 * message       → user message text
 */
export type SendChatParams = {
  conversationId: string;
  sessionId: string;
  message: string;
  sessionToken?: string | null;
};

/**
 * Response shape returned by /api/chat
 */
export type SendChatResponse = {
  reply: string;
};

/**
 * Send a chat message to the backend.
 *
 * This function is intentionally thin:
 * - It does not manage conversation state
 * - It does not store messages
 * - It only handles transport + idempotency fields
 */
export async function sendChatMessage(
  params: SendChatParams
): Promise<SendChatResponse> {
  const { conversationId, sessionId, message, sessionToken } = params;

  if (!conversationId) {
    throw new Error("conversationId is required");
  }
  if (!sessionId) {
    throw new Error("sessionId is required");
  }
  if (!message?.trim()) {
    throw new Error("message must be non-empty");
  }

  const payload = {
    conversation_id: conversationId,
    session_id: sessionId,
    message_id: uuidv4(),
    message,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = "Chat request failed";
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as SendChatResponse;

  if (typeof data.reply !== "string") {
    throw new Error("Invalid response from chat API");
  }

  return data;
}
