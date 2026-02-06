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
    <main className="chatPanel">
      <div className="chatPanel__header">
        <div>
          <div className="chatPanel__title">
            {conversation?.title ?? "Samtale"}
          </div>
          <div className="chatPanel__subtitle">
            Velg en samtale til venstre, eller start en ny.
          </div>
        </div>

        <button
          onClick={() => navigate("/soundtest")}
          className="chatPanel__soundButton"
          title="Ga til lydovelser"
        >
          Lydovelser
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
