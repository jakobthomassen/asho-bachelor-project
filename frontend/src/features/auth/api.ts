import { API_BASE_URL } from "../../config";

export type AuthResponse = {
  userId: string;
  sessionToken: string;
  isAdmin: boolean;
};

export type AuthMeResponse = {
  userId: string;
  isAdmin: boolean;
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
  const isAdmin =
    (typeof obj?.isAdmin === "boolean" && obj.isAdmin) ||
    (typeof obj?.is_admin === "boolean" && obj.is_admin) ||
    false;

  if (!userId || !sessionToken) {
    throw new Error("Invalid auth response");
  }

  return { userId, sessionToken, isAdmin };
}

function coerceAuthMeResponse(data: unknown): AuthMeResponse {
  const obj = data as Record<string, unknown> | null;
  const userId =
    (typeof obj?.userId === "string" && obj.userId) ||
    (typeof obj?.user_id === "string" && obj.user_id) ||
    null;
  const isAdmin =
    (typeof obj?.isAdmin === "boolean" && obj.isAdmin) ||
    (typeof obj?.is_admin === "boolean" && obj.is_admin) ||
    false;

  if (!userId) {
    throw new Error("Invalid auth/me response");
  }

  return { userId, isAdmin };
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

export async function fetchAuthMe(sessionToken: string): Promise<AuthMeResponse> {
  if (!sessionToken) {
    throw new Error("Missing session token");
  }

  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (!res.ok) {
    let detail = "Failed to fetch auth profile";
    try {
      const err = await res.json();
      if (err?.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as unknown;
  return coerceAuthMeResponse(data);
}

export async function revokeSession(sessionToken: string | null): Promise<void> {
  if (!sessionToken) return;

  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });
}
