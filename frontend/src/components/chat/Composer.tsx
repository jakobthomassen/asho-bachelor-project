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
        <div className="composer__inputWrap">
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
          <div className="composer__inputActions">
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
              title="Send"
              aria-label="Send melding"
              style={{
                color: sendDisabled ? "var(--text-muted)" : "var(--accent)",
                cursor: sendDisabled ? "not-allowed" : "pointer",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 -960 960 960"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M507-480 384-357l56 57 180-180-180-180-56 57 123 123ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="composer__disclaimer">
        ASHO er en AI og kan gjøre feil. Vennligst dobbeltsjekk viktig informasjon.
      </div>
    </div>
  );
}
