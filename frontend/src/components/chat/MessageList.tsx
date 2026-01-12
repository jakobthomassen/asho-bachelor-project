import type { Conversation } from "../../features/conversations/types";
import MessageBubble from "./MessageBubble";
import ClarifyChips from "./ClarifyChips";
import "./ChatPanel.css";

type Props = {
  conversation: Conversation | undefined;
  clarifyOptions: string[];
  isSending: boolean;
  onSendText: (text: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export default function MessageList({
  conversation,
  clarifyOptions,
  isSending,
  onSendText,
  messagesEndRef,
}: Props) {
  return (
    <div className="messages">
      {conversation?.messages.map((m) => (
        <div key={m.id} className={`row ${m.role === "user" ? "right" : "left"}`}>
          <div className="bubbleWrap">
            <MessageBubble message={m} />
            {m.role !== "user" && (
              <ClarifyChips
                options={clarifyOptions}
                disabled={isSending || !conversation}
                onPick={onSendText}
              />
            )}
          </div>
        </div>
      ))}

      {isSending && <div className="typing">ASHO skriver…</div>}
      <div ref={messagesEndRef} />
    </div>
  );
}
