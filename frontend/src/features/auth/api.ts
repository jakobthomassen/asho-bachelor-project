import { API_BASE_URL } from "../../config";

export type AuthResponse = {
  userId: string;
  sessionToken: string;
};

function coerceAuthResponse(data: unknown): AuthResponse {
  const obj = data as Record<string, unknown> | null;
  const userId =
    (typeof obj?.userId === "string" && obj.userId) ||
    (typeof obj?.user_id === "string" && obj.user_id) ||
    null;
  const sessionToken =
    (typeof obj?.sessionToken === "string" && obj.sessionToken) ||
    (typeof obj?.session_token === "string" && obj.session_token) ||
    null;

  if (!userId || !sessionToken) {
    throw new Error("Invalid auth response");
  }

  return { userId, sessionToken };
}

export async function exchangeGoogleCredential(
  credential: string
): Promise<AuthResponse> {
  if (!credential) {
    throw new Error("Missing Google credential");
  }

  const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  if (!res.ok) {
    let detail = "Google auth failed";
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as unknown;
  return coerceAuthResponse(data);
}
