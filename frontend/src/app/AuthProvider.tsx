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
import { revokeSession } from "../features/auth/api";
import {
  disableGoogleAutoSelect,
  initGoogleIdentity,
  promptGoogleSignIn,
  renderGoogleButton,
  clickRenderedButton,
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
  const handledRedirectRef = useRef(false);
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (handledRedirectRef.current) return;
    handledRedirectRef.current = true;

    const hash = window.location.hash || "";
    if (!hash.startsWith("#auth=google")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionToken = params.get("session_token");
    const userId = params.get("user_id");

    console.info("[auth] redirect detected", {
      hasSessionToken: Boolean(sessionToken),
      hasUserId: Boolean(userId),
    });

    if (sessionToken && userId) {
      writeStoredAuth(userId, sessionToken);
      setState((prev) => ({
        ...prev,
        userId,
        sessionToken,
        error: null,
      }));
    }

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
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

      if (ok && buttonContainerRef.current) {
        const rendered = await renderGoogleButton(buttonContainerRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
        });
        console.info("[auth] GIS button rendered", { rendered });
      }
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
    console.info("[auth] login requested");
    const clicked = buttonContainerRef.current
      ? clickRenderedButton(buttonContainerRef.current)
      : false;
    console.info("[auth] renderButton click", { clicked });

    if (!clicked) {
      const ok = await promptGoogleSignIn();
      console.info("[auth] prompt result", { ok });
      if (!ok) {
        setState((prev) => ({ ...prev, error: "Google sign-in unavailable" }));
      }
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

  return (
    <AuthContext.Provider value={value}>
      {children}
      <div
        ref={buttonContainerRef}
        style={{
          position: "fixed",
          left: -10000,
          top: -10000,
          width: 240,
          height: 44,
          overflow: "hidden",
        }}
        aria-hidden
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
