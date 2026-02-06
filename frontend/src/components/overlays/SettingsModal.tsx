type ThemeOption = "green" | "purple" | "blue";
type ModeOption = "light" | "dark";

type Props = {
  open: boolean;
  onClose: () => void;
  theme: ThemeOption;
  mode: ModeOption;
  onThemeChange: (theme: ThemeOption) => void;
  onModeChange: (mode: ModeOption) => void;
};

const themeLabels: Record<ThemeOption, string> = {
  green: "Green",
  purple: "Purple",
  blue: "Blue/Turquoise",
};

export default function SettingsModal({
  open,
  onClose,
  theme,
  mode,
  onThemeChange,
  onModeChange,
}: Props) {
  if (!open) return null;

  return (
    <div className="subscribeOverlay" onClick={onClose}>
      <div className="subscribeModal settingsModal" onClick={(e) => e.stopPropagation()}>
        <h2 className="subscribeTitle">Innstillinger</h2>

        <div className="settingsSection">
          <div className="settingsLabel">Dark mode</div>
          <label className="settingsToggle">
            <input
              type="checkbox"
              checked={mode === "dark"}
              onChange={(e) => onModeChange(e.target.checked ? "dark" : "light")}
            />
            <span>{mode === "dark" ? "On" : "Off"}</span>
          </label>
        </div>

        <div className="settingsSection">
          <div className="settingsLabel">Color theme</div>
          <div className="settingsThemeGrid">
            {Object.keys(themeLabels).map((key) => {
              const k = key as ThemeOption;
              const active = theme === k;
              return (
                <button
                  key={k}
                  type="button"
                  className={`settingsThemeButton ${active ? "is-active" : ""}`}
                  onClick={() => onThemeChange(k)}
                >
                  {themeLabels[k]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="settingsActions">
          <button className="subscribeClose" onClick={onClose}>
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
}
