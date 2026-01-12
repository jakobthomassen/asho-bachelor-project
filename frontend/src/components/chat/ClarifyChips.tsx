import "./ChatPanel.css";

export default function ClarifyChips({
  options,
  disabled,
  onPick,
}: {
  options: string[];
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="chips">
      {options.map((label) => (
        <button
          key={label}
          className="chip"
          onClick={() => onPick(label)}
          disabled={disabled}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
