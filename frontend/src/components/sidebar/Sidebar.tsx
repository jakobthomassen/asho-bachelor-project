import type { Conversation } from "../../features/conversations/types";

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
    <aside
      style={{
        width: 280,
        borderRight: "1px solid #e5e7eb",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#0f172a" }}>
          ASHO
        </div>
        <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 4 }}>
          Samtaler (historikk)
        </div>

        <button
          onClick={onNewConversation}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "0.6rem 0.8rem",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "#0f766e",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          New conversation
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: "0.5rem" }}>
        {conversations.map((c) => {
          const active = c.id === activeId;

          return (
            <button
              key={c.id}
              onClick={() => onSelectConversation(c.id)}
              onContextMenu={(e) => onOpenContextMenu(e, c.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.75rem",
                borderRadius: 12,
                border: active ? "1px solid #0f766e" : "1px solid transparent",
                background: active ? "#ecfdf5" : "transparent",
                cursor: "pointer",
                marginBottom: 6,
              }}
              title="Høyreklikk for flere valg"
            >
              <div style={{ fontWeight: 600, color: "#111827", fontSize: "0.95rem" }}>
                {c.title || "Samtale"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 2 }}>
                {new Date(c.updatedAt).toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
