import { API_BASE_URL } from "../constants/config";

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: number;
};

function authHeaders(sessionToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  };
}

function toSummary(raw: {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}): ConversationSummary {
  return {
    id: raw.id,
    title: raw.title,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

async function getErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const err = await res.json();
    if (typeof err?.detail === "string" && err.detail) return err.detail;
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function listConversations(
  sessionToken: string
): Promise<ConversationSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/conversations`, {
    method: "GET",
    headers: authHeaders(sessionToken),
  });

  if (!res.ok) {
    throw new Error(await getErrorDetail(res, "Failed to load conversations"));
  }

  const data = (await res.json()) as {
    conversations: { id: string; title: string; created_at: number; updated_at: number }[];
  };
  return (data.conversations ?? []).map(toSummary);
}

export async function createConversation(
  sessionToken: string,
  title?: string
): Promise<ConversationSummary> {
  const res = await fetch(`${API_BASE_URL}/api/conversations`, {
    method: "POST",
    headers: authHeaders(sessionToken),
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    throw new Error(await getErrorDetail(res, "Failed to create conversation"));
  }

  return toSummary(await res.json());
}

export async function deleteConversation(
  sessionToken: string,
  conversationId: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
    method: "DELETE",
    headers: authHeaders(sessionToken),
  });

  if (!res.ok) {
    throw new Error(await getErrorDetail(res, "Failed to delete conversation"));
  }
}

export async function fetchConversationMessages(
  sessionToken: string,
  conversationId: string,
  limit = 200
): Promise<ConversationMessage[]> {
  const url = `${API_BASE_URL}/api/conversations/${conversationId}/messages?limit=${limit}`;

  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(sessionToken),
  });

  if (!res.ok) {
    throw new Error(await getErrorDetail(res, "Failed to load messages"));
  }

  const data = (await res.json()) as {
    messages: { id: string; role: "user" | "assistant" | "system"; text: string; created_at: number }[];
  };
  return (data.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    createdAt: m.created_at,
  }));
}
