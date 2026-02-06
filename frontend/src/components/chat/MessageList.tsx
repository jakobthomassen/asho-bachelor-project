import type { Conversation } from "../../features/conversations/types";
import ClarifyChips from "./ClarifyChips";
import "./MessageList.css";

type Props = {
  conversation: Conversation | undefined;
  clarifyOptions: string[];
  isSending: boolean;
  onSendText: (text: string) => void;
  endRef: React.RefObject<HTMLDivElement | null>;
};

export default function MessageList({
  conversation,
  clarifyOptions,
  isSending,
  onSendText,
  endRef,
}: Props) {
  const messages = conversation?.messages ?? [];

  const lastAshoIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "asho") return i;
    }
    return -1;
  })();

  return (
    <div className="messageList">
      {messages.map((m, idx) => {
        const isUser = m.role === "user";
        const showClarify = !isUser && idx === lastAshoIndex;

        return (
          <div
            key={m.id}
            className={`messageRow ${isUser ? "is-user" : "is-asho"}`}
            style={{
              display: "flex",
              justifyContent: isUser ? "flex-end" : "flex-start",
              marginBottom: 12,
            }}
          >
            <div style={{ maxWidth: "68%" }}>
              <div
                className={`messageBubble ${isUser ? "is-user" : "is-asho"}`}
              >
                <div className="messageMeta">
                  {isUser ? "Meg" : "ASHO"}
                </div>
                <div className="messageText">{m.text}</div>
              </div>

              {showClarify && (
                <ClarifyChips
                  options={clarifyOptions}
                  disabled={isSending}
                  onPick={onSendText}
                />
              )}
            </div>
          </div>
        );
      })}

      {isSending && <div className="messageTyping">ASHO skriver...</div>}

      <div ref={endRef} />
    </div>
  );
}
