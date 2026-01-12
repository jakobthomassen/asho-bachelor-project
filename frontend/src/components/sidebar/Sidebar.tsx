import "./Sidebar.css";
import type { Conversation } from "../../features/conversations/types";

type Props = {
  conversations: Conversation[];
  activeId: string;
  onNew: () => void;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, convId: string) => void;
  onHover: (id: string | null) => void;
  hoveredId: string | null;
};

export default function Sidebar({
  conversations,
  activeId,
  onNew,
  onSelect,
  onContextMenu,
  onHover,
  hoveredId,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebarHeader">
        <div className="brand">ASHO</div>
        <div className="sub">Samtaler (historikk)</div>

        <button className="btnPrimary full" onClick={onNew}>
          New conversation
        </button>
      </div>

      <div className="sidebarList">
        {conversations.map((c) => {
          const active = c.id === activeId;
          const hovered = hoveredId === c.id;

          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              onContextMenu={(e) => onContextMenu(e, c.id)}
              onMouseEnter={() => onHover(c.id)}
              onMouseLeave={() => onHover(null)}
              className={`convRow ${active ? "active" : ""} ${
                hovered ? "hovered" : ""
              }`}
              title="Høyreklikk for flere valg"
            >
              <div className="convTitle">{c.title || "Samtale"}</div>
              <div className="convMeta">
                {new Date(c.updatedAt).toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
