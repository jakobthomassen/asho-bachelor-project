export type ChatUiError = {
  id: string;
  explanation: string;
  technical?: string;
};

type Props = {
  error: ChatUiError;
  onDismiss: () => void;
};

export default function ErrorBanner({ error, onDismiss }: Props) {
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
      <div style={{ display: "grid", gap: 2 }}>
        <span>{error.explanation}</span>
        <span style={{ fontSize: 12, fontWeight: 700 }}>
          Feil-ID: {error.id}
        </span>
        {error.technical ? (
          <span style={{ fontSize: 12, color: "#7f1d1d", fontWeight: 500 }}>
            Detaljer: {error.technical}
          </span>
        ) : null}
      </div>

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
