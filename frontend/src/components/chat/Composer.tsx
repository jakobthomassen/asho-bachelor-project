import "./ChatPanel.css";

type Props = {
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  disabled: boolean;
  sendDisabled: boolean;
};

export default function Composer({
  input,
  setInput,
  onKeyDown,
  onSend,
  disabled,
  sendDisabled,
}: Props) {
  return (
    <div className="composer">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Skriv en melding…"
        disabled={disabled}
        className="input"
      />
      <button onClick={onSend} disabled={sendDisabled} className="sendBtn">
        Send
      </button>
    </div>
  );
}
