import type { Conversation } from "../../features/conversations/types";

type Props = {
  conversation: Conversation | undefined;
  clarifyOptions: string[];
  isSending: boolean;
  onSendText: (text: string) => void;
};

export default function MessageList({
  conversation,
  clarifyOptions,
  isSending,
  onSendText,
}: Props) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
      {conversation?.messages.map((m) => {
        const isUser = m.role === "user";

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
                  borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
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

              {!isUser && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {clarifyOptions.map((label) => (
                    <button
                      key={label}
                      onClick={() => onSendText(label)}
                      disabled={isSending}
                      style={{
                        padding: "0.4rem 0.65rem",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        color: "#0f172a",
                        fontSize: "0.85rem",
                        cursor: isSending ? "not-allowed" : "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isSending && <div style={{ color: "#6b7280" }}>ASHO skriver…</div>}
    </div>
  );
}
