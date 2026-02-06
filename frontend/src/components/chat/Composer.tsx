type Props = {
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  isSending: boolean;
  disabled: boolean;
};

export default function Composer({
  input,
  setInput,
  onKeyDown,
  onSend,
  isSending,
  disabled,
}: Props) {
  const sendDisabled = disabled || isSending || !input.trim();

  return (
    <div
      style={{
        padding: "0.65rem 1.25rem",
        borderTop: "1px solid var(--border)",
        background: "#ffffff",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Skriv en melding…"
        disabled={disabled || isSending}
        style={{
          flex: 1,
          padding: "0.5rem 0.85rem",
          borderRadius: 12,
          border: "1px solid var(--border)",
          outline: "none",
          fontSize: "0.95rem",
          color: "var(--text-primary)",
          background: disabled || isSending ? "var(--surface-muted)" : "var(--surface)",
        }}
      />
      <button
        type="button"
        onClick={() => window.alert("WIP")}
        disabled={disabled || isSending}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled || isSending ? "not-allowed" : "pointer",
          color: "var(--text-primary)",
        }}
        title="Mikrofon"
        aria-label="Mikrofon"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
      <button
        onClick={onSend}
        disabled={sendDisabled}
        style={{
          padding: "0.5rem 0.9rem",
          borderRadius: 10,
          border: "none",
          background: sendDisabled ? "var(--button-disabled)" : "var(--accent)",
          color: sendDisabled ? "var(--text-muted)" : "var(--accent-contrast)",
          fontWeight: 800,
          cursor: sendDisabled ? "not-allowed" : "pointer",
        }}
      >
        {isSending ? "Sender…" : "Send"}
      </button>
    </div>
  );
}
