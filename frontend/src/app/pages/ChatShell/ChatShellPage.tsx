import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, Message } from "../../../features/conversations/types";
import { uid } from "../../../features/conversations/helpers";
import {
  createConversation as createConversationApi,
  deleteConversation as deleteConversationApi,
  fetchConversationMessages,
  listConversations,
} from "../../../features/conversations/api";
import {
  getSessionIdForConversation,
  removeSessionIdForConversation,
} from "../../../features/conversations/session";
import {
  loadConversations as loadCachedConversations,
  saveConversations as saveCachedConversations,
} from "../../../features/conversations/storage";
import { sendChatMessage } from "../../../features/chat/api";
import { API_BASE_URL } from "../../../config";
import { useAuth } from "../../AuthProvider";

import Sidebar from "../../../components/sidebar/Sidebar";
import ChatPanel from "../../../components/chat/ChatPanel";
import type { ChatUiError } from "../../../components/chat/ErrorBanner";
import ContextMenu from "../../../components/overlays/ContextMenu";
import ConfirmModal from "../../../components/overlays/ConfirmModal";
import ResourcesModal from "../../../components/overlays/ResourcesModal";
import SettingsModal from "../../../components/overlays/SettingsModal";


import "./ChatShellPage.css";

const LOGO_URL =
  "https://static.wixstatic.com/media/ce15e3_4878766d65e44a919042edd86151d790~mv2.png/v1/fill/w_133,h_64,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/inf.png";

type ContextMenuState =
  | { open: true; x: number; y: number; convId: string }
  | { open: false };

type ConfirmState = { open: true; convId: string } | { open: false };
type BackendStatus = "idle" | "checking" | "ok" | "error";

export default function ChatShellPage() {
  const { userId, sessionToken, isAdmin, logout } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<ChatUiError | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false });
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });
  const [showResources, setShowResources] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("idle");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [colorTheme, setColorTheme] = useState<"green" | "purple" | "blue">("green");
  const [mode, setMode] = useState<"light" | "dark">("light");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedRef = useRef(false);
  const streamRef = useRef<{ cancelled: boolean } | null>(null);

  const clarifyOptions = ["Kan du utdype?", "Gi et eksempel", "Oppsummer kort"];

  const makeErrorId = () => {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `ASHO-${ts}-${rnd}`;
  };

  const setUiError = (explanation: string, technical?: string) => {
    setError({
      id: makeErrorId(),
      explanation,
      technical,
    });
  };

  useEffect(() => {
    if (!sessionToken) {
      hasLoadedRef.current = false;
      setConversations([]);
      setActiveId("");
      return;
    }

    const cachedRaw = loadCachedConversations(userId);
    const cached = cachedRaw.map((c) => ({
      ...c,
      sessionId: c.sessionId || getSessionIdForConversation(c.id),
      messagesLoaded: c.messagesLoaded ?? (c.messages?.length ? true : false),
    }));
    if (cached.length > 0) {
      const sorted = [...cached].sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(sorted);
      setActiveId(sorted[0]?.id ?? "");
    }

    let cancelled = false;

    const load = async () => {
      setError(null);
      try {
        let list = await listConversations(sessionToken);
        if (cancelled) return;

        if (list.length === 0) {
          const created = await createConversationApi(sessionToken, "Ny samtale");
          if (cancelled) return;
          list = [created];
        }

        const existing = new Map(cached.map((c) => [c.id, c]));
        const mapped = list.map((c) => {
          const prev = existing.get(c.id);
          return {
            id: c.id,
            sessionId: getSessionIdForConversation(c.id),
            title: c.title,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            messages: prev?.messages ?? [],
            messagesLoaded: prev?.messagesLoaded ?? false,
          };
        });

        setConversations(mapped);
        setActiveId(mapped[0]?.id ?? "");
        hasLoadedRef.current = true;
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Kunne ikke laste samtaler";
        setUiError("Kunne ikke laste samtaler.", message);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [sessionToken, userId]);

  useEffect(() => {
    if (!userId) return;
    if (!hasLoadedRef.current) return;
    saveCachedConversations(userId, conversations);
  }, [conversations, userId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId]
  );

  useEffect(() => {
    if (!sessionToken || !activeId) return;
    const current = conversations.find((c) => c.id === activeId);
    if (!current || current.messagesLoaded) return;

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const messages = await fetchConversationMessages(sessionToken, activeId);
        if (cancelled) return;
        updateConversation(activeId, (c) => ({
          ...c,
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role === "user" ? "user" : "asho",
            text: m.text,
            createdAt: m.createdAt,
          })),
          messagesLoaded: true,
        }));
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Kunne ikke laste meldinger";
        setUiError("Kunne ikke laste meldinger.", message);
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [sessionToken, activeId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, activeConversation?.messages.length, isSending]);

  useEffect(() => {
    if (!contextMenu.open) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-context-menu="true"]')) return;
      setContextMenu({ open: false });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu({ open: false });
    };

    const onResize = () => setContextMenu({ open: false });
    const onScroll = () => setContextMenu({ open: false });

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [contextMenu.open]);

  useEffect(() => {
    if (!confirm.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirm({ open: false });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirm.open]);

  useEffect(() => {
    const storedTheme = localStorage.getItem("asho_theme");
    const storedMode = localStorage.getItem("asho_mode");

    if (storedTheme === "green" || storedTheme === "purple" || storedTheme === "blue") {
      setColorTheme(storedTheme);
    }

    if (storedMode === "light" || storedMode === "dark") {
      setMode(storedMode);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = colorTheme;
    root.dataset.mode = mode;
    localStorage.setItem("asho_theme", colorTheme);
    localStorage.setItem("asho_mode", mode);
  }, [colorTheme, mode]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.cancelled = true;
        streamRef.current = null;
      }
    };
  }, []);

  const createConversation = async () => {
    setError(null);
    if (!sessionToken) {
      setUiError("Du må logge inn for å starte en ny samtale.");
      return;
    }

    try {
      const created = await createConversationApi(sessionToken, "Ny samtale");
      const next = {
        id: created.id,
        sessionId: getSessionIdForConversation(created.id),
        title: created.title,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        messages: [],
        messagesLoaded: true,
      };
      setConversations((prev) => [next, ...prev]);
      setActiveId(created.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke opprette samtale";
      setUiError("Kunne ikke opprette samtale.", message);
    }
  };

  const selectConversation = (id: string) => {
    setError(null);
    setActiveId(id);
  };

  const updateConversation = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === id ? updater(c) : c));
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      return next;
    });
  };

  const updateMessageText = (conversationId: string, messageId: string, text: string) => {
    updateConversation(conversationId, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === messageId ? { ...m, text } : m)),
    }));
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const streamAssistantReply = async (
    conversationId: string,
    messageId: string,
    fullText: string
  ) => {
    if (!fullText) return;
    const token = { cancelled: false };
    if (streamRef.current) streamRef.current.cancelled = true;
    streamRef.current = token;

    let i = 0;
    while (i < fullText.length) {
      if (token.cancelled) return;

      const chunkSize =
        fullText.length > 400 ? 12 : fullText.length > 200 ? 8 : 4;
      i = Math.min(fullText.length, i + chunkSize);
      updateMessageText(conversationId, messageId, fullText.slice(0, i));

      const jitter = Math.floor(Math.random() * 12);
      await sleep(8 + jitter);
    }
  };

  const deleteConversation = async (id: string) => {
    setError(null);
    if (!sessionToken) {
      setUiError("Du må logge inn for å slette samtaler.");
      return;
    }

    try {
      await deleteConversationApi(sessionToken, id);
      removeSessionIdForConversation(id);
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (activeId === id) {
          setActiveId(filtered[0]?.id ?? "");
        }
        return filtered;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke slette samtale";
      setUiError("Kunne ikke slette samtale.", message);
    }
  };

  const titleFor = (id: string) => conversations.find((c) => c.id === id)?.title ?? "Samtale";

  const openContextMenu = (e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 72;

    let x = e.clientX;
    let y = e.clientY;

    const maxX = window.innerWidth - menuWidth - 8;
    const maxY = window.innerHeight - menuHeight - 8;

    if (x > maxX) x = Math.max(8, maxX);
    if (y > maxY) y = Math.max(8, maxY);

    setContextMenu({ open: true, x, y, convId });
  };

  const requestDeleteFromMenu = () => {
    if (!contextMenu.open) return;
    setConfirm({ open: true, convId: contextMenu.convId });
    setContextMenu({ open: false });
  };

  const confirmDelete = async () => {
    if (!confirm.open) return;
    await deleteConversation(confirm.convId);
    setConfirm({ open: false });
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !activeConversation || isSending) return;

    setError(null);
    if (!sessionToken) {
      setUiError("Du må logge inn for å sende meldinger.");
      return;
    }
    setIsSending(true);
    setInput("");

    const now = Date.now();
    const userMsg: Message = {
      id: uid(),
      role: "user",
      text: trimmed,
      createdAt: now,
    };

    updateConversation(activeConversation.id, (c) => ({
      ...c,
      updatedAt: now,
      messages: [...c.messages, userMsg],
    }));

    try {
      const { reply, conversation_title } = await sendChatMessage({
        conversationId: activeConversation.id,
        sessionId: activeConversation.sessionId,
        message: trimmed,
        sessionToken,
      });

      const botId = uid();
      const botMsg: Message = {
        id: botId,
        role: "asho",
        text: "",
        createdAt: Date.now(),
      };

      updateConversation(activeConversation.id, (c) => ({
        ...c,
        title: conversation_title?.trim() ? conversation_title : c.title,
        updatedAt: Date.now(),
        messages: [...c.messages, botMsg],
      }));

      await streamAssistantReply(activeConversation.id, botId, reply);
      updateMessageText(activeConversation.id, botId, reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setUiError("Serverfeil. Prøv igjen.", message);
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = () => sendText(input);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const pingBackend = useCallback(async () => {
    setBackendStatus("checking");
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
      setBackendStatus(res.ok ? "ok" : "error");
    } catch {
      setBackendStatus("error");
    }
  }, []);

  const backendDotClass =
    backendStatus === "ok"
      ? "is-green"
      : backendStatus === "error"
        ? "is-red"
        : "is-yellow";

  const backendLabel =
    backendStatus === "ok"
      ? "OK"
      : backendStatus === "error"
        ? "Feil"
        : backendStatus === "checking"
          ? "Sjekker"
          : "Ikke sjekket";

  return (
    <div className="chatShell">
      <div
        className={`chatShell__main ${isSidebarCollapsed ? "chatShell__main--sidebarCollapsed" : ""}`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          onNewConversation={createConversation}
          onSelectConversation={selectConversation}
          onOpenContextMenu={openContextMenu}
          topSlot={
            <>
              <img src={LOGO_URL} alt="ASHO logo" className="chatShell__logo" />
              <div className="chatShell__title">ASHO</div>
              <div className="chatShell__subtitle">Støtte gjennom vanskelige tider</div>
            </>
          }
          bottomSlot={
            <>
              <div className="chatShell__nav">
                <button className="chatShell__navButton chatShell__statusButton" onClick={pingBackend}>
                  <span>Backend status</span>
                  <span className={`chatShell__statusMeta ${backendDotClass}`}>
                    <span className="chatShell__statusDot" aria-hidden="true" />
                    <span>{backendLabel}</span>
                  </span>
                </button>
                <button
                  className="chatShell__navButton"
                  onClick={() => setShowResources(true)}
                >
                  Ressurser
                </button>
                <button
                  className="chatShell__navButton"
                  onClick={() => setShowSettings(true)}
                >
                  Innstillinger
                </button>

                <div className="chatShell__auth chatShell__auth--sidebar">
                  <button className="chatShell__authButton" onClick={logout}>
                    Logg ut
                  </button>
                </div>
              </div>
            </>
          }
        />

        <ChatPanel
          conversation={activeConversation}
          input={input}
          setInput={setInput}
          isSending={isSending}
          clarifyOptions={clarifyOptions}
          onSendText={sendText}
          onSend={sendMessage}
          onKeyDown={onKeyDown}
          error={error}
          onDismissError={() => setError(null)}
          endRef={messagesEndRef}
        />

        {contextMenu.open && (
          <ContextMenu
            open={contextMenu.open}
            x={contextMenu.x}
            y={contextMenu.y}
            title={titleFor(contextMenu.convId)}
            onDelete={requestDeleteFromMenu}
            onClose={() => setContextMenu({ open: false })}
          />
        )}

        <ConfirmModal
          open={confirm.open}
          title="Slett samtale?"
          description={
            <>
              Dette vil slette <b>{confirm.open ? titleFor(confirm.convId) : ""}</b> og dens meldinger. Du kan ikke angre
              dette.
            </>
          }
          onCancel={() => setConfirm({ open: false })}
          onConfirm={confirmDelete}

        />

        <ResourcesModal
            open={showResources}
            onClose={() => setShowResources(false)}
        />

        <SettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          theme={colorTheme}
          mode={mode}
          onThemeChange={setColorTheme}
          onModeChange={setMode}
          isAdmin={isAdmin}
        />

      </div>
    </div>
  );
}
