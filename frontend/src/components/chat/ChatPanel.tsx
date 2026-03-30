import type { Conversation } from "../../features/conversations/types";
import MessageList from "./MessageList";
import Composer from "./Composer";
import WelcomePrompt from "./WelcomePrompt";
import ErrorBanner from "./ErrorBanner";
import type { ChatUiError } from "./ErrorBanner";
import "./ChatPanel.css";

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
  const isEmpty = !conversation?.messages?.length;

  return (
    <main className="chatPanel">
      {error && <ErrorBanner error={error} onDismiss={onDismissError} />}

      {isEmpty ? (
        <div className="chatPanel__welcome">
          <WelcomePrompt />
          <Composer
            input={input}
            setInput={setInput}
            onKeyDown={onKeyDown}
            onSend={onSend}
            isSending={isSending}
            disabled={!conversation}
          />
        </div>
      ) : (
        <div className="chatPanel__content">
          <div className="chatPanel__titleBar">
            <h1 className="chatPanel__title">
              {conversation?.title?.trim() || "Ny samtale"}
            </h1>
          </div>
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
        </div>
      )}
    </main>
  );
}
