import type { Message } from "../../features/conversations/types";
import "./ChatPanel.css";

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`bubble ${isUser ? "user" : "asho"}`}>
      <div className="bubbleMeta">{isUser ? "Meg" : "ASHO"}</div>
      <div className="bubbleText">{message.text}</div>
    </div>
  );
}
