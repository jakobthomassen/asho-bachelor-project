import { API_BASE_URL } from "../../config";

export async function postChatMessage(params: {
  sessionId: string;
  message: string;
  messageId: string;
}) {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: params.sessionId,
      message_id: params.messageId,
      message: params.message,
    }),
  });

  const data = await res.json();
  return { reply: String(data.reply ?? "") };
}
