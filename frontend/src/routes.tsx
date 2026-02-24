import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import ChatShellPage from "./app/pages/ChatShell/ChatShellPage";
import SoundTestPage from "./app/pages/Soundtest/SoundtestPage";
import SubscribePage from "./app/pages/Subscribe/SubscribePage";
import UroSkolenPage from "./app/pages/UroSkole/UroSkolePage";
import TopicDashboardPage from "./app/pages/TopicDashboard/TopicDashboardPage";
import Chat from "./Chat";
import { useAuth } from "./app/AuthProvider";
import WelcomePage from "./app/pages/Welcome/WelcomePage";
import LoginPage from "./app/pages/Login/LoginPage";
import OnboardingPage from "./app/pages/Onboarding/OnboardingPage";
import { getProfileName } from "./features/profile/storage";

function hasProfileName() {
  return getProfileName().trim().length > 0;
}

function ChatRoute({ children }: { children: ReactElement }) {
  const { sessionToken, isBootstrapped } = useAuth();
  const location = useLocation();

  if (!isBootstrapped) return null;
  if (!sessionToken) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />;
  }
  if (!hasProfileName()) return <Navigate to="/onboarding" replace />;
  return children;
}

function LoginRoute({ children }: { children: ReactElement }) {
  const { sessionToken, isBootstrapped } = useAuth();

  if (!isBootstrapped) return null;
  if (sessionToken && hasProfileName()) return <Navigate to="/" replace />;
  if (sessionToken) return <Navigate to="/onboarding" replace />;
  return children;
}

function OnboardingRoute({ children }: { children: ReactElement }) {
  const { sessionToken, isBootstrapped } = useAuth();

  if (!isBootstrapped) return null;
  if (!sessionToken) return <Navigate to="/login?next=%2Fonboarding" replace />;
  if (hasProfileName()) return <Navigate to="/" replace />;
  return children;
}

function AdminRoute({ children }: { children: ReactElement }) {
  const { sessionToken, isAdmin } = useAuth();
  if (!sessionToken) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ChatRoute>
              <ChatShellPage />
            </ChatRoute>
          }
        />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route
          path="/login"
          element={
            <LoginRoute>
              <LoginPage />
            </LoginRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <OnboardingPage />
            </OnboardingRoute>
          }
        />
        <Route path="/chat" element={<Navigate to="/" replace />} />
        <Route path="/soundtest" element={<SoundTestPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/uro-skolen" element={<UroSkolenPage />} />
        <Route
          path="/dashboard"
          element={
            <AdminRoute>
              <TopicDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/debug"
          element={
            <AdminRoute>
              <Chat />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
