import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchAuthMe, revokeSession } from "../api/auth";

const SESSION_TOKEN_KEY = "asho_session_token";

type AuthState = {
  sessionToken: string | null;
  userId: string | null;
  isAdmin: boolean;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (sessionToken: string, userId: string, isAdmin: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    sessionToken: null,
    userId: null,
    isAdmin: false,
    isLoading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
        if (stored) {
          const me = await fetchAuthMe(stored);
          setState({
            sessionToken: stored,
            userId: me.userId,
            isAdmin: me.isAdmin,
            isLoading: false,
          });
        } else {
          setState((s) => ({ ...s, isLoading: false }));
        }
      } catch {
        await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
        setState({ sessionToken: null, userId: null, isAdmin: false, isLoading: false });
      }
    })();
  }, []);

  const signIn = async (
    sessionToken: string,
    userId: string,
    isAdmin: boolean
  ) => {
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    setState({ sessionToken, userId, isAdmin, isLoading: false });
  };

  const signOut = async () => {
    const { sessionToken } = state;
    await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
    setState({ sessionToken: null, userId: null, isAdmin: false, isLoading: false });
    if (sessionToken) {
      revokeSession(sessionToken).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
