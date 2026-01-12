type Props = {
  open: boolean;
  x?: number;
  y?: number;
  title?: string;
  onDelete: () => void;
};

export default function ContextMenu({ open, x, y, title, onDelete }: Props) {
  if (!open) return null;

  return (
    <div
      data-context-menu="true"
      style={{
        position: "fixed",
        left: x,
        top: y,
        width: 220,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 18px 40px rgba(15,23,42,0.14)",
        padding: 6,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          fontSize: 12,
          color: "#6b7280",
          fontWeight: 700,
        }}
      >
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
          fontWeight: 800,
          color: "#b91c1c",
        }}
      >
        Slett samtale
      </button>
    </div>
  );
}
