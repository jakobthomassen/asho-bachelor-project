import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, Message } from "../../../features/conversations/types";
import { loadConversations, saveConversations } from "../../../features/conversations/storage";
import { makeNewConversation, uid } from "../../../features/conversations/helpers";
import { sendChatMessage } from "../../../features/chat/api";
import { useAuth } from "../../AuthProvider";

import Sidebar from "../../../components/sidebar/Sidebar";
import ChatPanel from "../../../components/chat/ChatPanel";
import ContextMenu from "../../../components/overlays/ContextMenu";
import ConfirmModal from "../../../components/overlays/ConfirmModal";
import SubscribeModal from "../../../components/overlays/SubscribeModal";
import ChatInfoModal from "../../../components/overlays/ChatInfoModal";

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


  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const clarifyOptions = ["Kan du utdype?", "Gi et eksempel", "Oppsummer kort"];

  useEffect(() => {
    const initial = loadConversations();
    if (initial.length === 0) {
      const c = makeNewConversation();
      setConversations([c]);
      setActiveId(c.id);
      saveConversations([c]);
    } else {
      const sorted = [...initial].sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(sorted);
      setActiveId(sorted[0].id);
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations);
  }, [conversations]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId]
  );

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

  const createConversation = () => {
    setError(null);
    const c = makeNewConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
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

  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);

      if (activeId === id) {
        if (filtered.length > 0) setActiveId(filtered[0].id);
        else {
          const c = makeNewConversation();
          setActiveId(c.id);
          return [c];
        }
      }

      return filtered;
    });
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

  const confirmDelete = () => {
    if (!confirm.open) return;
    deleteConversation(confirm.convId);
    setConfirm({ open: false });
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !activeConversation || isSending) return;

    setError(null);
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
      title:
        c.messages.filter((m) => m.role === "user").length === 0
          ? trimmed.slice(0, 28)
          : c.title,
      updatedAt: now,
      messages: [...c.messages, userMsg],
    }));

    try {
      const { reply } = await sendChatMessage({
        chatId: activeConversation.id,
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

      updateConversation(activeConversation.id, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          {
            id: uid(),
            role: "asho",
            text: "Serverfeil. Prøv igjen.",
            createdAt: Date.now(),
          },
        ],
      }));
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
                <button className="chatShell__navButton">Uro-skolen</button>
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

      </div>
    </div>
  );
}
