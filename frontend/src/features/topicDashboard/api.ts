import { API_BASE_URL } from "../../config";

export type TopicDashboardTopic = {
  topic_key: string;
  title: string;
  version_no: number;
  is_current: boolean;
  classifier_description: string;
  classifier_keywords: string[];
  classifier_exclude_keywords: string[];
  classifier_embedding: number[] | null;
  system_prompt: string;
  micro_instructions: Record<string, unknown>;
  constraints: Record<string, unknown>;
  pacing_rules: Record<string, unknown>;
  reclassify_rules: Record<string, unknown>;
  safety_rules: Record<string, unknown>;
  min_confidence: number;
  reclassify_turn_threshold: number;
  max_clarifying_questions: number;
  examples: unknown[];
};

export type TopicDashboardDailyTokens = {
  day: string;
  total_tokens: number;
};

export type TopicDashboardStats = {
  total_unique_users: number;
  total_conversations: number;
  avg_conversations_per_user: number;
  avg_conversation_length_messages: number;
  monthly_estimated_token_cost_usd: number;
  total_estimated_token_cost_usd: number;
  daily_tokens: TopicDashboardDailyTokens[];
};

type TopicDashboardListResponse = {
  topics: TopicDashboardTopic[];
};

type SaveTopicVersionPayload = {
  title: string;
  classifier_description: string;
  classifier_keywords: string[];
  classifier_exclude_keywords: string[];
  system_prompt: string;
  micro_instructions: Record<string, unknown>;
  constraints: Record<string, unknown>;
  pacing_rules: Record<string, unknown>;
  reclassify_rules: Record<string, unknown>;
  safety_rules: Record<string, unknown>;
  min_confidence: number;
  reclassify_turn_threshold: number;
  max_clarifying_questions: number;
  examples: unknown[];
  created_by?: string;
};

function authHeaders(sessionToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  };
}

function extractErrorDetail(raw: unknown, fallback: string): string {
  if (raw && typeof raw === "object" && "detail" in raw) {
    const detail = (raw as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

export async function listTopicDashboardTopics(sessionToken: string): Promise<TopicDashboardTopic[]> {
  const res = await fetch(`${API_BASE_URL}/api/topic-dashboard/topics`, {
    method: "GET",
    headers: authHeaders(sessionToken),
  });

  if (!res.ok) {
    let detail = "Failed to load topics";
    try {
      detail = extractErrorDetail(await res.json(), detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as TopicDashboardListResponse;
  return data.topics ?? [];
}

export async function saveTopicVersion(
  sessionToken: string,
  topicKey: string,
  payload: SaveTopicVersionPayload
): Promise<TopicDashboardTopic> {
  const res = await fetch(`${API_BASE_URL}/api/topic-dashboard/topics/${encodeURIComponent(topicKey)}/versions`, {
    method: "POST",
    headers: authHeaders(sessionToken),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = "Failed to save topic version";
    try {
      detail = extractErrorDetail(await res.json(), detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  return (await res.json()) as TopicDashboardTopic;
}

export async function getTopicDashboardStats(sessionToken: string, days = 7): Promise<TopicDashboardStats> {
  const safeDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.round(days))) : 7;
  const res = await fetch(`${API_BASE_URL}/api/topic-dashboard/stats?days=${safeDays}`, {
    method: "GET",
    headers: authHeaders(sessionToken),
  });

  if (!res.ok) {
    let detail = "Failed to load dashboard stats";
    try {
      detail = extractErrorDetail(await res.json(), detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  return (await res.json()) as TopicDashboardStats;
}

export async function calculateTopicVector(
  sessionToken: string,
  topicKey: string
): Promise<TopicDashboardTopic> {
  const res = await fetch(
    `${API_BASE_URL}/api/topic-dashboard/topics/${encodeURIComponent(topicKey)}/calculate-vector`,
    {
      method: "POST",
      headers: authHeaders(sessionToken),
    }
  );

  if (!res.ok) {
    let detail = "Failed to calculate vector";
    try {
      detail = extractErrorDetail(await res.json(), detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  return (await res.json()) as TopicDashboardTopic;
}
