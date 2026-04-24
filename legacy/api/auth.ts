import { API_BASE_URL } from "../constants/config";

export type AuthResponse = {
  userId: string;
  sessionToken: string;
  isAdmin: boolean;
};

export type RegisterResponse = {
  userId: string;
  requiresEmailVerification: boolean;
  verificationToken: string | null;
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

  if (!userId) throw new Error("Invalid register response");

  return { userId, requiresEmailVerification, verificationToken };
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

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(await getErrorDetail(res, "Login failed"));
  }

  return coerceAuthResponse(await res.json());
}

export async function registerWithEmailPassword(
  email: string,
  password: string
): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(await getErrorDetail(res, "Registration failed"));
  }

  return coerceRegisterResponse(await res.json());
}

export async function fetchAuthMe(
  sessionToken: string
): Promise<{ userId: string; isAdmin: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!res.ok) throw new Error("Session expired");

  const obj = (await res.json()) as Record<string, unknown>;
  const userId =
    (typeof obj?.userId === "string" && obj.userId) ||
    (typeof obj?.user_id === "string" && obj.user_id) ||
    null;
  const isAdmin =
    (typeof obj?.isAdmin === "boolean" && obj.isAdmin) ||
    (typeof obj?.is_admin === "boolean" && obj.is_admin) ||
    false;

  if (!userId) throw new Error("Invalid auth/me response");

  return { userId, isAdmin };
}

export async function revokeSession(sessionToken: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
}
