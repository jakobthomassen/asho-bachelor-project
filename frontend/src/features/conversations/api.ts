import { API_BASE_URL } from "../../config";

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

type ConversationListResponse = {
  conversations: {
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
  }[];
};

type ConversationCreateResponse = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
};

type ConversationMessagesResponse = {
  messages: {
    id: string;
    role: "user" | "assistant" | "system";
    text: string;
    created_at: number;
  }[];
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

export async function listConversations(
  sessionToken: string
): Promise<ConversationSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/conversations`, {
    method: "GET",
    headers: authHeaders(sessionToken),
  });

  if (!res.ok) {
    let detail = "Failed to load conversations";
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as ConversationListResponse;
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
    let detail = "Failed to create conversation";
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as ConversationCreateResponse;
  return toSummary(data);
}

export async function updateConversationTitle(
  sessionToken: string,
  conversationId: string,
  title: string
): Promise<ConversationSummary> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: authHeaders(sessionToken),
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    let detail = "Failed to update conversation";
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as ConversationCreateResponse;
  return toSummary(data);
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
    let detail = "Failed to delete conversation";
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

export async function fetchConversationMessages(
  sessionToken: string,
  conversationId: string,
  limit = 200
): Promise<ConversationMessage[]> {
  const url = new URL(
    `${API_BASE_URL}/api/conversations/${conversationId}/messages`
  );
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(sessionToken),
  });

  if (!res.ok) {
    let detail = "Failed to load messages";
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as ConversationMessagesResponse;
  return (data.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    createdAt: m.created_at,
  }));
}
