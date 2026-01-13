type Props = {
  options: string[];
  disabled?: boolean;
  onPick: (text: string) => void;
};

export default function ClarifyChips({ options, disabled, onPick }: Props) {
  return (
    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((label) => (
        <button
          key={label}
          onClick={() => onPick(label)}
          disabled={disabled}
          style={{
            padding: "0.4rem 0.65rem",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#0f172a",
            fontSize: "0.85rem",
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
