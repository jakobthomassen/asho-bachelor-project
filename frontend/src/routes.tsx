import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ChatShellPage from "./app/pages/ChatShell/ChatShellPage";
import Chat from "./Chat";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatShellPage />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
