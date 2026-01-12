import "./ChatPanel.css";
import type { Conversation } from "../../features/conversations/types";
import MessageList from "./MessageList";
import Composer from "./Composer";
import ErrorBanner from "./ErrorBanner";

type Props = {
  conversation: Conversation | undefined;
  input: string;
  setInput: (v: string) => void;
  isSending: boolean;
  error: string | null;
  clarifyOptions: string[];
  onSend: () => void;
  onSendText: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export default function ChatPanel({
  conversation,
  input,
  setInput,
  isSending,
  error,
  clarifyOptions,
  onSend,
  onSendText,
  onKeyDown,
  messagesEndRef,
}: Props) {
  return (
    <main className="chat">
      <div className="chatHeader">
        <div className="chatTitle">{conversation?.title ?? "Samtale"}</div>
        <div className="chatSub">
          Velg en samtale til venstre, eller start en ny.
        </div>
      </div>

      <ErrorBanner error={error} />

      <MessageList
        conversation={conversation}
        clarifyOptions={clarifyOptions}
        isSending={isSending}
        onSendText={onSendText}
        messagesEndRef={messagesEndRef}
      />

      <Composer
        input={input}
        setInput={setInput}
        onKeyDown={onKeyDown}
        onSend={onSend}
        disabled={!conversation || isSending}
        sendDisabled={!input.trim() || isSending || !conversation}
      />
    </main>
  );
}
