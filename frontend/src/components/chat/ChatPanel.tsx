import type { Conversation } from "../../features/conversations/types";
import MessageList from "./MessageList";
import Composer from "./Composer";
import ErrorBanner from "./ErrorBanner";
import type { ChatUiError } from "./ErrorBanner";

type Props = {
  conversation: Conversation | undefined;
  input: string;
  setInput: (v: string) => void;
  isSending: boolean;
  clarifyOptions: string[];
  onSendText: (text: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  error: ChatUiError | null;
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

        <span />
      </div>

      {error && <ErrorBanner error={error} onDismiss={onDismissError} />}

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
