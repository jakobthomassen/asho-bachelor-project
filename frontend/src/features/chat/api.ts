import { API_BASE_URL } from "../../config";
import { v4 as uuidv4 } from "uuid";

/**
 * Parameters required to send a chat message to the backend.
 *
 * chatId        → durable conversation identifier (maps to backend chat_id)
 * sessionId     → ephemeral client/session identifier
 * message       → user message text
 */
export type SendChatParams = {
  chatId: string;
  sessionId: string;
  message: string;
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
  const { chatId, sessionId, message } = params;

  if (!chatId) {
    throw new Error("chatId is required");
  }
  if (!sessionId) {
    throw new Error("sessionId is required");
  }
  if (!message?.trim()) {
    throw new Error("message must be non-empty");
  }

  const payload = {
    chat_id: chatId,
    session_id: sessionId,
    message_id: uuidv4(),
    message,
  };

  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
