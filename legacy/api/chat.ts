import { API_BASE_URL } from "../constants/config";

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type SendChatParams = {
  conversationId: string;
  sessionId: string;
  message: string;
  sessionToken?: string | null;
};

export type SendChatResponse = {
  reply: string;
  conversation_title?: string | null;
};

export async function sendChatMessage(
  params: SendChatParams
): Promise<SendChatResponse> {
  const { conversationId, sessionId, message, sessionToken } = params;

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

export { uuidv4 };
