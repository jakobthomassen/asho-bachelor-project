import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, Message } from "../../../features/conversations/types";
import { uid } from "../../../features/conversations/helpers";
import {
  createConversation as createConversationApi,
  deleteConversation as deleteConversationApi,
  fetchConversationMessages,
  listConversations,
  updateConversationTitle,
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
import { useAuth } from "../../AuthProvider";

import Sidebar from "../../../components/sidebar/Sidebar";
import ChatPanel from "../../../components/chat/ChatPanel";
import ContextMenu from "../../../components/overlays/ContextMenu";
import ConfirmModal from "../../../components/overlays/ConfirmModal";
import SubscribeModal from "../../../components/overlays/SubscribeModal";
import ChatInfoModal from "../../../components/overlays/ChatInfoModal";
import UroSkoleModal from "../../../components/overlays/UroSkoleModal";


import "./ChatShellPage.css";

const LOGO_URL =
  "https://static.wixstatic.com/media/ce15e3_4878766d65e44a919042edd86151d790~mv2.png/v1/fill/w_133,h_64,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/inf.png";

type ContextMenuState =
  | { open: true; x: number; y: number; convId: string }
  | { open: false };

type ConfirmState = { open: true; convId: string } | { open: false };

export default function ChatShellPage() {
  const { userId, sessionToken, isReady, error: authError, login, logout } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false });
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showUroSkole, setShowUroSkole] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedRef = useRef(false);

  const clarifyOptions = ["Kan du utdype?", "Gi et eksempel", "Oppsummer kort"];

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
        setError(message);
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
        setError(message);
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

  const createConversation = async () => {
    setError(null);
    if (!sessionToken) {
      setError("Du må logge inn for å starte en ny samtale.");
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
      setError(message);
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

  const deleteConversation = async (id: string) => {
    setError(null);
    if (!sessionToken) {
      setError("Du må logge inn for å slette samtaler.");
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
      setError(message);
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
      setError("Du må logge inn for å sende meldinger.");
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

    const shouldUpdateTitle =
      activeConversation.messages.filter((m) => m.role === "user").length === 0;
    const nextTitle = shouldUpdateTitle ? trimmed.slice(0, 28) : activeConversation.title;

    updateConversation(activeConversation.id, (c) => ({
      ...c,
      title: nextTitle,
      updatedAt: now,
      messages: [...c.messages, userMsg],
    }));

    if (shouldUpdateTitle && nextTitle !== activeConversation.title && sessionToken) {
      void updateConversationTitle(sessionToken, activeConversation.id, nextTitle);
    }

    try {
      const { reply } = await sendChatMessage({
        conversationId: activeConversation.id,
        sessionId: activeConversation.sessionId,
        message: trimmed,
        sessionToken,
      });

      const botMsg: Message = {
        id: uid(),
        role: "asho",
        text: reply,
        createdAt: Date.now(),
      };

      updateConversation(activeConversation.id, (c) => ({
        ...c,
        updatedAt: Date.now(),
        messages: [...c.messages, botMsg],
      }));
    } catch {
      setError("Serverfeil. Prøv igjen.");
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

  return (
    <div className="chatShell">
      <div className="chatShell__header">
        <div className="chatShell__headerSpacer" />

        <div className="chatShell__brand">
            <img src={LOGO_URL} alt="ASHO logo" className="chatShell__logo" />
            <div className="chatShell__title">ASHO</div>
            <div className="chatShell__subtitle">støtte gjennom vanskelige tider</div>

            <div className="chatShell__nav">
                <button className="chatShell__navButton" onClick={() => setShowChatInfo(true)}
                >
                Chat
                </button>

                <button className="chatShell__navButton" onClick={() => setShowSubscribe(true)}>
                    Abonner
                </button>
                <button
                    className="chatShell__navButton"
                    onClick={() => setShowUroSkole(true)}
                    >
                    Uro-skolen
                </button>
            </div>

            </div>
        <div className="chatShell__auth">
          {userId ? (
            <>
              <div className="chatShell__authUser">Innlogget</div>
              <button className="chatShell__authButton" onClick={logout}>
                Logg ut
              </button>
            </>
          ) : (
            <button
              className="chatShell__authButton"
              onClick={login}
              disabled={!isReady}
            >
              Logg inn med Google
            </button>
          )}
          {authError ? <div className="chatShell__authError">{authError}</div> : null}
        </div>
      </div>

      <div className="chatShell__main">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onNewConversation={createConversation}
          onSelectConversation={selectConversation}
          onOpenContextMenu={openContextMenu}
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

        <SubscribeModal
            open={showSubscribe}
            onClose={() => setShowSubscribe(false)}
        />

        <ChatInfoModal
            open={showChatInfo}
            onClose={() => setShowChatInfo(false)}
        />

        <UroSkoleModal
            open={showUroSkole}
            onClose={() => setShowUroSkole(false)}
        />

      </div>
    </div>
  );
}
