import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ChatShellPage from "./app/pages/ChatShell/ChatShellPage";
import SoundTestPage from "./app/pages/Soundtest/SoundtestPage";
import Chat from "./Chat";
import SubscribePage from "./app/pages/Subscribe/SubscribePage";
import UroSkolenPage from "./app/pages/UroSkole/UroSkolePage";
import TopicDashboardPage from "./app/pages/TopicDashboard/TopicDashboardPage";
import { useAuth } from "./app/AuthProvider";

function AdminRoute({ children }: { children: JSX.Element }) {
  const { sessionToken, isAdmin } = useAuth();
  if (!sessionToken) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatShellPage />} />
        <Route path="/chat" element={<Chat />} />
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
      </Routes>
    </BrowserRouter>
  );
}
