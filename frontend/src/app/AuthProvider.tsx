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
import { exchangeGoogleCredential, revokeSession } from "../features/auth/api";
import {
  disableGoogleAutoSelect,
  initGoogleIdentity,
  promptGoogleSignIn,
} from "../features/auth/google";

type AuthState = {
  userId: string | null;
  sessionToken: string | null;
  isReady: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "asho.auth.session";

function readStoredAuth(): { userId: string; sessionToken: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; sessionToken?: string };
    if (typeof parsed.userId !== "string") return null;
    if (typeof parsed.sessionToken !== "string") return null;
    return { userId: parsed.userId, sessionToken: parsed.sessionToken };
  } catch {
    return null;
  }
}

function writeStoredAuth(userId: string, sessionToken: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, sessionToken }));
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
      isReady: false,
      error: null,
    };
  });

  const initializedRef = useRef(false);

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
        onCredential: async (response) => {
          if (!response.credential) {
            setState((prev) => ({ ...prev, error: "Google sign-in failed" }));
            return;
          }

          try {
            const result = await exchangeGoogleCredential(response.credential);
            if (cancelled) return;
            writeStoredAuth(result.userId, result.sessionToken);
            setState({
              userId: result.userId,
              sessionToken: result.sessionToken,
              isReady: true,
              error: null,
            });
          } catch (err) {
            if (cancelled) return;
            const message = err instanceof Error ? err.message : "Auth failed";
            setState((prev) => ({ ...prev, error: message }));
          }
        },
      });

      if (cancelled) return;

      initializedRef.current = ok;
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
        error: null,
      }));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null }));
    if (!initializedRef.current) {
      setState((prev) => ({ ...prev, error: "Google sign-in unavailable" }));
      return;
    }
    const ok = await promptGoogleSignIn();
    if (!ok) {
      setState((prev) => ({ ...prev, error: "Google sign-in unavailable" }));
    }
  }, []);

  const logout = useCallback(() => {
    void revokeSession(state.sessionToken);
    clearStoredAuth();
    disableGoogleAutoSelect();
    setState((prev) => ({
      ...prev,
      userId: null,
      sessionToken: null,
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
