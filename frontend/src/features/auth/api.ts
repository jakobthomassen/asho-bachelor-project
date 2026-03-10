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

export type RegisterResponse = {
  userId: string;
  requiresEmailVerification: boolean;
  verificationToken: string | null;
};

function getApiErrorDetail(err: unknown, fallback: string): string {
  const detail = (err as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" && detail ? detail : fallback;
}

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

function coerceRegisterResponse(data: unknown): RegisterResponse {
  const obj = data as Record<string, unknown> | null;
  const userId =
    (typeof obj?.userId === "string" && obj.userId) ||
    (typeof obj?.user_id === "string" && obj.user_id) ||
    null;
  const requiresEmailVerification =
    (typeof obj?.requiresEmailVerification === "boolean" &&
      obj.requiresEmailVerification) ||
    (typeof obj?.requires_email_verification === "boolean" &&
      obj.requires_email_verification) ||
    false;
  const verificationToken =
    (typeof obj?.verificationToken === "string" && obj.verificationToken) ||
    (typeof obj?.verification_token === "string" && obj.verification_token) ||
    null;

  if (!userId) {
    throw new Error("Invalid register response");
  }

  return { userId, requiresEmailVerification, verificationToken };
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

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let detail = "Login failed";
    try {
      detail = getApiErrorDetail(await res.json(), detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  return coerceAuthResponse(await res.json());
}

export async function registerWithEmailPassword(
  email: string,
  password: string
): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let detail = "Registration failed";
    try {
      detail = getApiErrorDetail(await res.json(), detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  return coerceRegisterResponse(await res.json());
}

export async function exchangeSessionCookie(): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/session`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Session cookie exchange failed");
  }

  const data = (await res.json()) as unknown;
  return coerceAuthResponse(data);
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
