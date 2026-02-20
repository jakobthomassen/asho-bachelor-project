import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GOOGLE_CLIENT_ID } from "../config";
import { fetchAuthMe, revokeSession } from "../features/auth/api";
import {
  disableGoogleAutoSelect,
  initGoogleIdentity,
} from "../features/auth/google";

type AuthState = {
  userId: string | null;
  sessionToken: string | null;
  isAdmin: boolean;
  isReady: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "asho.auth.session";
const AUTH_NEXT_PATH_KEY = "asho_auth_next_path";

function readStoredAuth(): { userId: string; sessionToken: string; isAdmin: boolean } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      userId?: string;
      sessionToken?: string;
      isAdmin?: boolean;
    };
    if (typeof parsed.userId !== "string") return null;
    if (typeof parsed.sessionToken !== "string") return null;
    return {
      userId: parsed.userId,
      sessionToken: parsed.sessionToken,
      isAdmin: parsed.isAdmin === true,
    };
  } catch {
    return null;
  }
}

function writeStoredAuth(userId: string, sessionToken: string, isAdmin: boolean) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, sessionToken, isAdmin }));
}

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = readStoredAuth();
    return {
      userId: stored?.userId ?? null,
      sessionToken: stored?.sessionToken ?? null,
      isAdmin: stored?.isAdmin ?? false,
      isReady: false,
      error: null,
    };
  });

  const initializedRef = useRef(false);
  const handledRedirectRef = useRef(false);

  useEffect(() => {
    if (handledRedirectRef.current) return;
    handledRedirectRef.current = true;

    const hash = window.location.hash || "";
    if (!hash.startsWith("#auth=google")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionToken = params.get("session_token");
    const userId = params.get("user_id");
    const isAdminParam = params.get("is_admin");
    const isAdmin = isAdminParam === "1" || isAdminParam === "true";

    console.info("[auth] redirect detected", {
      hasSessionToken: Boolean(sessionToken),
      hasUserId: Boolean(userId),
    });

    if (sessionToken && userId) {
      writeStoredAuth(userId, sessionToken, isAdmin);
      setState((prev) => ({
        ...prev,
        userId,
        sessionToken,
        isAdmin,
        error: null,
      }));
    }

    const storedNextPath = sessionStorage.getItem(AUTH_NEXT_PATH_KEY);
    if (storedNextPath) {
      sessionStorage.removeItem(AUTH_NEXT_PATH_KEY);
    }
    const cleanUrl = storedNextPath && storedNextPath.startsWith("/")
      ? storedNextPath
      : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setState((prev) => ({
        ...prev,
        isReady: false,
        error: "Missing Google client id",
      }));
      return;
    }

    let cancelled = false;

    const setup = async () => {
      const ok = await initGoogleIdentity({
        clientId: GOOGLE_CLIENT_ID,
      });

      if (cancelled) return;

      initializedRef.current = ok;
      console.info("[auth] GIS initialized", { ok });
      setState((prev) => ({
        ...prev,
        isReady: ok,
        error: ok ? prev.error : "Google sign-in unavailable",
      }));
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== STORAGE_KEY) return;
      const stored = readStoredAuth();
      setState((prev) => ({
        ...prev,
        userId: stored?.userId ?? null,
        sessionToken: stored?.sessionToken ?? null,
        isAdmin: stored?.isAdmin ?? false,
        error: null,
      }));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!state.sessionToken) return;

    let cancelled = false;

    const syncAuthProfile = async () => {
      try {
        const me = await fetchAuthMe(state.sessionToken as string);
        if (cancelled) return;
        writeStoredAuth(me.userId, state.sessionToken as string, me.isAdmin);
        setState((prev) => ({
          ...prev,
          userId: me.userId,
          isAdmin: me.isAdmin,
          error: null,
        }));
      } catch {
        if (cancelled) return;
        clearStoredAuth();
        setState((prev) => ({
          ...prev,
          userId: null,
          sessionToken: null,
          isAdmin: false,
          error: null,
        }));
      }
    };

    void syncAuthProfile();

    return () => {
      cancelled = true;
    };
  }, [state.sessionToken]);

  const login = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null }));
    if (!initializedRef.current) {
      setState((prev) => ({ ...prev, error: "Google sign-in unavailable" }));
      return;
    }
    console.info("[auth] login requested (unused)");
  }, []);

  const logout = useCallback(() => {
    void revokeSession(state.sessionToken);
    clearStoredAuth();
    disableGoogleAutoSelect();
    setState((prev) => ({
      ...prev,
      userId: null,
      sessionToken: null,
      isAdmin: false,
      error: null,
    }));
  }, [state.sessionToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
    }),
    [state, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
