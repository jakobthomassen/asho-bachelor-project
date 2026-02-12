import type React from "react";
import type { Conversation } from "../../features/conversations/types";
import "./Sidebar.css";

type Props = {
  conversations: Conversation[];
  activeId: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, convId: string) => void;
  topSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
};

export default function Sidebar({
  conversations,
  activeId,
  isCollapsed,
  onToggleCollapse,
  onNewConversation,
  onSelectConversation,
  onOpenContextMenu,
  topSlot,
  bottomSlot,
}: Props) {
  return (
    <aside className={`sidebar ${isCollapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar__top">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="sidebar__toggleButton"
          title={isCollapsed ? "Utvid sidepanel" : "Skjul sidepanel"}
          aria-label={isCollapsed ? "Utvid sidepanel" : "Skjul sidepanel"}
        >
          {isCollapsed ? ">" : "<"}
        </button>

        {!isCollapsed && topSlot ? <div className="sidebar__brand">{topSlot}</div> : null}

        <button
          onClick={onNewConversation}
          className="sidebar__newButton"
          title={isCollapsed ? "Ny samtale" : undefined}
        >
          {isCollapsed ? "+" : "Ny samtale"}
        </button>
      </div>

      {!isCollapsed && (
        <div className="sidebar__list">
          {conversations.map((c) => {
            const active = c.id === activeId;

            return (
              <button
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                onContextMenu={(e) => onOpenContextMenu(e, c.id)}
                className={`sidebar__item ${active ? "is-active" : ""}`}
                title="Hoyreklikk for flere valg"
              >
                <div className="sidebar__title">{c.title || "Samtale"}</div>
                <div className="sidebar__time">{new Date(c.updatedAt).toLocaleString()}</div>
              </button>
            );
          })}
        </div>
      )}

      {!isCollapsed && bottomSlot ? <div className="sidebar__bottom">{bottomSlot}</div> : null}
    </aside>
  );
}
