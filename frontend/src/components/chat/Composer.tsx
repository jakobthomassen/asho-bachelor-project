import { useEffect, useRef } from "react";
import "./Composer.css";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const wasSendingRef = useRef(isSending);
  const sendDisabled = disabled || isSending || !input.trim();

  useEffect(() => {
    if (wasSendingRef.current && !isSending && !disabled) {
      inputRef.current?.focus();
    }
    wasSendingRef.current = isSending;
  }, [disabled, isSending]);

  return (
    <div className="composerShell">
      <div className="composer">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Skriv en melding…"
          disabled={disabled || isSending}
          className="composer__input"
          style={{
            background:
              disabled || isSending ? "var(--surface-muted)" : "var(--surface)",
          }}
        />
        <button
          type="button"
          onClick={() => window.alert("WIP")}
          disabled={disabled || isSending}
          className="composer__mic"
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
          className="composer__send"
          style={{
            background: sendDisabled ? "var(--button-disabled)" : "var(--accent)",
            color: sendDisabled ? "var(--text-muted)" : "var(--accent-contrast)",
            cursor: sendDisabled ? "not-allowed" : "pointer",
          }}
        >
          {isSending ? "Sender…" : "Send"}
        </button>
      </div>
      <div className="composer__disclaimer">
        ASHO er en AI og kan gjøre feil. Vennligst dobbeltsjekk viktig informasjon.
      </div>
    </div>
  );
}
