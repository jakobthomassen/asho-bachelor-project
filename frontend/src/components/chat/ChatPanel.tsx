import type { Conversation } from "../../features/conversations/types";
import { useNavigate } from "react-router-dom";
import MessageList from "./MessageList";
import Composer from "./Composer";
import ErrorBanner from "./ErrorBanner";

type Props = {
  conversation: Conversation | undefined;
  input: string;
  setInput: (v: string) => void;
  isSending: boolean;
  clarifyOptions: string[];
  onSendText: (text: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  error: string | null;
  onDismissError: () => void;

  endRef: React.RefObject<HTMLDivElement | null>;
};

export default function ChatPanel({
  conversation,
  input,
  setInput,
  isSending,
  clarifyOptions,
  onSendText,
  onSend,
  onKeyDown,
  error,
  onDismissError,
  endRef,
}: Props) {
  const navigate = useNavigate();

  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>
            {conversation?.title ?? "Samtale"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 4 }}>
            Velg en samtale til venstre, eller start en ny.
          </div>
        </div>

        <button
          onClick={() => navigate("/soundtest")}
          style={{
            padding: "0.45rem 0.85rem",
            borderRadius: 999,
            border: "1px solid #0f766e",
            background: "#ecfdf5",
            color: "#0f766e",
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          title="Gå til lydøvelser"
        >
          Lydøvelser
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={onDismissError} />}

      <MessageList
        conversation={conversation}
        clarifyOptions={clarifyOptions}
        isSending={isSending}
        onSendText={onSendText}
        endRef={endRef}
      />

      <Composer
        input={input}
        setInput={setInput}
        onKeyDown={onKeyDown}
        onSend={onSend}
        isSending={isSending}
        disabled={!conversation}
      />
    </main>
  );
}
