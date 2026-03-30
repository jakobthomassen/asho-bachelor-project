import { useEffect, useRef, useState } from "react";
import "./Composer.css";

const SpeechRecognitionAPI =
  typeof window !== "undefined" &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

const sttSupported = !!SpeechRecognitionAPI;

type Props = {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  isSending: boolean;
  disabled: boolean;
};

export default function Composer({
  input,
  setInput,
  onSend,
  isSending,
  disabled,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasSendingRef = useRef(isSending);
  const recognitionRef = useRef<any>(null);
  const sendDisabled = disabled || isSending || !input.trim();

  const [isListening, setIsListening] = useState(false);
  const [sttNote, setSttNote] = useState(false);

  // Refocus after send
  useEffect(() => {
    if (wasSendingRef.current && !isSending && !disabled) {
      textareaRef.current?.focus();
    }
    wasSendingRef.current = isSending;
  }, [disabled, isSending]);

  // Auto-resize up to CSS max-height; show scrollbar only when capped
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, [input]);

  // Stop recognition when component unmounts or input is disabled
  useEffect(() => {
    if ((disabled || isSending) && isListening) {
      recognitionRef.current?.stop();
    }
  }, [disabled, isSending]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const toggleListening = () => {
    if (!sttSupported) {
      setSttNote(true);
      setTimeout(() => setSttNote(false), 3500);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "nb-NO";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      setInput(input ? `${input} ${transcript}` : transcript);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendDisabled) onSend();
    }
  };

  const micLabel = !sttSupported
    ? "Talegjenkjenning støttes ikke i denne nettleseren"
    : isListening
      ? "Stopp opptak"
      : "Start taleopptak";

  return (
    <div className="composerShell">
      <div className="composer">
        <div className="composer__inputWrap">
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv en melding…"
            disabled={disabled || isSending}
            className="composer__input"
            style={{
              background:
                disabled || isSending ? "var(--surface-muted)" : "var(--surface)",
            }}
          />
          <div className="composer__inputActions">
            <div className="composer__micWrap">
              <button
                type="button"
                onClick={toggleListening}
                disabled={disabled || isSending}
                className={[
                  "composer__mic",
                  !sttSupported ? "composer__mic--unsupported" : "",
                  isListening ? "composer__mic--active" : "",
                ].join(" ").trim()}
                title={micLabel}
                aria-label={micLabel}
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
                {!sttSupported && <span className="composer__micSlash" aria-hidden="true" />}
              </button>
              {sttNote && (
                <div className="composer__sttNote" role="alert">
                  Ikke støttet i denne nettleseren
                </div>
              )}
            </div>
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
