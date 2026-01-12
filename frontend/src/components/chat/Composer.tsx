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
  const sendDisabled = !input.trim() || isSending || disabled;

  return (
    <div
      style={{
        padding: "0.9rem 1.25rem",
        borderTop: "1px solid #e5e7eb",
        background: "#ffffff",
        display: "flex",
        gap: 10,
      }}
    >
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Skriv en melding…"
        disabled={isSending || disabled}
        style={{
          flex: 1,
          padding: "0.7rem 1rem",
          borderRadius: 999,
          border: "1px solid #d1d5db",
          outline: "none",
          fontSize: "1rem",
          color: "#111827",
        }}
      />
      <button
        onClick={onSend}
        disabled={sendDisabled}
        style={{
          padding: "0.7rem 1.1rem",
          borderRadius: 999,
          border: "none",
          background: sendDisabled ? "#e5e7eb" : "#0f766e",
          color: sendDisabled ? "#9ca3af" : "#ffffff",
          fontWeight: 700,
          cursor: sendDisabled ? "not-allowed" : "pointer",
        }}
      >
        Send
      </button>
    </div>
  );
}
