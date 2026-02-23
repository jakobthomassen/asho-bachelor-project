type Props = {
  open: boolean;
  x: number;
  y: number;
  title: string;
  onDelete: () => void;
  onClose: () => void;
};

export default function ContextMenu({ open, x, y, title, onDelete, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      data-context-menu="true"
      style={{
        position: "fixed",
        left: x,
        top: y,
        width: 220,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 18px 40px rgba(15,23,42,0.14)",
        padding: 6,
        zIndex: 1000,
      }}
      onMouseLeave={onClose}
    >
      <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>
        {title}
      </div>

      <button
        onClick={onDelete}
        style={{
          width: "100%",
          textAlign: "left",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: "10px 10px",
          borderRadius: 10,
          fontWeight: 900,
          color: "var(--danger)",
        }}
      >
        Slett samtale
      </button>
    </div>
  );
}
