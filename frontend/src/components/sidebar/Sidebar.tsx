import type { Conversation } from "../../features/conversations/types";
import "./Sidebar.css";

type Props = {
  conversations: Conversation[];
  activeId: string;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, convId: string) => void;
};

export default function Sidebar({
  conversations,
  activeId,
  onNewConversation,
  onSelectConversation,
  onOpenContextMenu,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <button onClick={onNewConversation} className="sidebar__newButton">
          Ny samtale
        </button>
      </div>

      <div className="sidebar__list">
        {conversations.map((c) => {
          const active = c.id === activeId;

          return (
            <button
              key={c.id}
              onClick={() => onSelectConversation(c.id)}
              onContextMenu={(e) => onOpenContextMenu(e, c.id)}
              className={`sidebar__item ${active ? "is-active" : ""}`}
              title="Høyreklikk for flere valg"
            >
              <div className="sidebar__title">{c.title || "Samtale"}</div>
              <div className="sidebar__time">{new Date(c.updatedAt).toLocaleString()}</div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
