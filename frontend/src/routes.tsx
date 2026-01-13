import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatShellPage from "./app/pages/ChatShell/ChatShellPage";
import SoundTestPage from "./app/pages/Soundtest/SoundtestPage";
import Chat from "./Chat";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatShellPage />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/soundtest" element={<SoundTestPage />} />
      </Routes>
    </BrowserRouter>
  );
}
