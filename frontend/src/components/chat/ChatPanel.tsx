import type { Conversation } from "../../features/conversations/types";
import MessageList from "./MessageList";
import Composer from "./Composer";

type Props = {
  conversation: Conversation | undefined;
  input: string;
  setInput: (v: string) => void;
  isSending: boolean;
  clarifyOptions: string[];
  onSendText: (text: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
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
}: Props) {
  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>
          {conversation?.title ?? "Samtale"}
        </div>
        <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 4 }}>
          Velg en samtale til venstre, eller start en ny.
        </div>
      </div>

      <MessageList
        conversation={conversation}
        clarifyOptions={clarifyOptions}
        isSending={isSending}
        onSendText={onSendText}
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
