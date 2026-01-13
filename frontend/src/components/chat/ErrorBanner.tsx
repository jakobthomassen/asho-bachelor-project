type Props = {
  message: string;
  onDismiss: () => void;
};

export default function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <div
      style={{
        padding: "0.75rem 1.25rem",
        background: "#fef2f2",
        borderBottom: "1px solid #fecaca",
        color: "#991b1b",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontWeight: 600,
      }}
      role="alert"
    >
      <span>{message}</span>

      <button
        onClick={onDismiss}
        style={{
          border: "1px solid #fecaca",
          background: "#ffffff",
          color: "#991b1b",
          borderRadius: 10,
          padding: "0.35rem 0.6rem",
          cursor: "pointer",
          fontWeight: 800,
        }}
      >
        Lukk
      </button>
    </div>
  );
}
