import type { Conversation } from "../../features/conversations/types";
import ClarifyChips from "./ClarifyChips";

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
    <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
      {messages.map((m, idx) => {
        const isUser = m.role === "user";
        const showClarify = !isUser && idx === lastAshoIndex;

        return (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: isUser ? "flex-end" : "flex-start",
              marginBottom: 12,
            }}
          >
            <div style={{ maxWidth: "70%" }}>
              <div
                style={{
                  padding: "0.7rem 0.9rem",
                  borderRadius: isUser
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                  background: isUser ? "#e5e7eb" : "#e0f2fe",
                  color: "#111827",
                  boxShadow: "0 4px 8px rgba(15,23,42,0.06)",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 2 }}>
                  {isUser ? "Meg" : "ASHO"}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
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

      {isSending && <div style={{ color: "#6b7280", marginTop: 6 }}>ASHO skriver…</div>}

      <div ref={endRef} />
    </div>
  );
}
