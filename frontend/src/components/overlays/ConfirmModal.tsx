type Props = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  open,
  title,
  description,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div
      onMouseDown={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 1100,
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 30px 80px rgba(15,23,42,0.25)",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18, color: "var(--text-primary)" }}>
          {title}
        </div>

        <div style={{ marginTop: 8, color: "var(--text-secondary)", lineHeight: 1.4 }}>
          {description}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "0.65rem 0.9rem",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Avbryt
          </button>

          <button
            onClick={onConfirm}
            style={{
              padding: "0.65rem 0.9rem",
              borderRadius: 12,
              border: "1px solid var(--danger)",
              background: "var(--danger)",
              color: "var(--accent-contrast)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Slett
          </button>
        </div>
      </div>
    </div>
  );
}
