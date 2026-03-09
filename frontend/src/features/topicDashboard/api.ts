import { API_BASE_URL } from "../../config";

export type TopicDashboardTopic = {
  topic_key: string;
  title: string;
  version_no: number;
  is_current: boolean;
  classifier_description: string;
  classifier_embedding: number[] | null;
  system_prompt: string;
  micro_instructions: Record<string, unknown>;
  constraints: Record<string, unknown>;
  reclassify_rules: Record<string, unknown>;
  safety_rules: Record<string, unknown>;
  min_confidence: number;
  reclassify_turn_threshold: number;
  max_clarifying_questions: number;
  updated_at: string | null;
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
  system_prompt: string;
  micro_instructions: Record<string, unknown>;
  constraints: Record<string, unknown>;
  reclassify_rules: Record<string, unknown>;
  safety_rules: Record<string, unknown>;
  min_confidence: number;
  reclassify_turn_threshold: number;
  max_clarifying_questions: number;
  created_by?: string;
};

type CreateTopicPayload = SaveTopicVersionPayload & { topic_key: string };

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

async function apiFetch<T>(url: string, options: RequestInit, fallback: string): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = fallback;
    try {
      detail = extractErrorDetail(await res.json(), detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function listTopicDashboardTopics(sessionToken: string): Promise<TopicDashboardTopic[]> {
  const data = await apiFetch<TopicDashboardListResponse>(
    `${API_BASE_URL}/api/topic-dashboard/topics`,
    { method: "GET", headers: authHeaders(sessionToken) },
    "Failed to load topics"
  );
  return data.topics ?? [];
}

export async function saveTopicVersion(
  sessionToken: string,
  topicKey: string,
  payload: SaveTopicVersionPayload
): Promise<TopicDashboardTopic> {
  return apiFetch<TopicDashboardTopic>(
    `${API_BASE_URL}/api/topic-dashboard/topics/${encodeURIComponent(topicKey)}/versions`,
    { method: "POST", headers: authHeaders(sessionToken), body: JSON.stringify(payload) },
    "Failed to save topic version"
  );
}

export async function getTopicDashboardStats(sessionToken: string, days = 7): Promise<TopicDashboardStats> {
  const safeDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.round(days))) : 7;
  return apiFetch<TopicDashboardStats>(
    `${API_BASE_URL}/api/topic-dashboard/stats?days=${safeDays}`,
    { method: "GET", headers: authHeaders(sessionToken) },
    "Failed to load dashboard stats"
  );
}

export async function createTopic(
  sessionToken: string,
  payload: CreateTopicPayload
): Promise<TopicDashboardTopic> {
  return apiFetch<TopicDashboardTopic>(
    `${API_BASE_URL}/api/topic-dashboard/topics`,
    { method: "POST", headers: authHeaders(sessionToken), body: JSON.stringify(payload) },
    "Failed to create topic"
  );
}

export type SecurityRejection = {
  id: number;
  conversation_id: string | null;
  session_id: string | null;
  message_id: string | null;
  user_id: string | null;
  message_preview: string | null;
  rejection_type: string;
  created_at: string | null;
};

export async function getSecurityRejections(
  sessionToken: string,
  limit = 200
): Promise<SecurityRejection[]> {
  const data = await apiFetch<{ rejections: SecurityRejection[] }>(
    `${API_BASE_URL}/api/topic-dashboard/security-rejections?limit=${limit}`,
    { method: "GET", headers: authHeaders(sessionToken) },
    "Failed to load security rejections"
  );
  return data.rejections ?? [];
}

export async function calculateTopicVector(
  sessionToken: string,
  topicKey: string
): Promise<TopicDashboardTopic> {
  return apiFetch<TopicDashboardTopic>(
    `${API_BASE_URL}/api/topic-dashboard/topics/${encodeURIComponent(topicKey)}/calculate-vector`,
    { method: "POST", headers: authHeaders(sessionToken) },
    "Failed to calculate vector"
  );
}
