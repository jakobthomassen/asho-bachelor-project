import { useEffect, useState } from "react";

type ThemeOption = "green" | "purple" | "blue";
type ModeOption = "light" | "dark";
type TabOption = "utseende" | "profil" | "personvern";

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
  const [activeTab, setActiveTab] = useState<TabOption>("utseende");
  const [profileName, setProfileName] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const showWip = () => window.alert("WIP");

  useEffect(() => {
    if (!open) return;
    const stored = localStorage.getItem("asho_profile_name");
    setProfileName(stored ?? "");
    setProfileSaved(false);
    setActiveTab("utseende");
  }, [open]);

  const saveProfile = () => {
    localStorage.setItem("asho_profile_name", profileName.trim());
    setProfileSaved(true);
  };

  if (!open) return null;

  return (
    <div className="subscribeOverlay" onClick={onClose}>
      <div className="subscribeModal settingsModal" onClick={(e) => e.stopPropagation()}>
        <h2 className="subscribeTitle">Innstillinger</h2>

        <div className="settingsLayout">
          <div className="settingsTabs" role="tablist" aria-label="Innstillinger faner">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "utseende"}
              className={`settingsTabButton ${activeTab === "utseende" ? "is-active" : ""}`}
              onClick={() => setActiveTab("utseende")}
            >
              Utseende
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "profil"}
              className={`settingsTabButton ${activeTab === "profil" ? "is-active" : ""}`}
              onClick={() => setActiveTab("profil")}
            >
              Profil
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "personvern"}
              className={`settingsTabButton ${activeTab === "personvern" ? "is-active" : ""}`}
              onClick={() => setActiveTab("personvern")}
            >
              Personvern
            </button>
          </div>

          <div className="settingsPanel">
            {activeTab === "utseende" && (
              <>
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
              </>
            )}

            {activeTab === "profil" && (
              <div className="settingsSection">
                <label className="settingsLabel" htmlFor="profile-name-input">
                  Brukernavn / kallenavn
                </label>
                <input
                  id="profile-name-input"
                  className="settingsInput"
                  value={profileName}
                  onChange={(e) => {
                    setProfileName(e.target.value);
                    setProfileSaved(false);
                  }}
                  placeholder="Skriv navn"
                />
                <div className="settingsProfileActions">
                  <button type="button" className="subscribeClose" onClick={saveProfile}>
                    Lagre
                  </button>
                  {profileSaved && <span className="settingsSaved">Lagret</span>}
                </div>
              </div>
            )}

            {activeTab === "personvern" && (
              <div className="settingsSection">
                <div className="settingsActionList">
                  <button type="button" className="settingsActionItem" onClick={showWip}>
                    Slett mine data
                  </button>
                  <button type="button" className="settingsActionItem settingsActionItem--danger" onClick={showWip}>
                    Slett konto
                  </button>
                </div>
              </div>
            )}
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
