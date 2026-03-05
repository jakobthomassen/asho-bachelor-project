import { useEffect, useState } from "react";
import { getProfileName, saveProfileName } from "../../features/profile/storage";

type ThemeOption = "green" | "purple" | "blue";
type ModeOption = "light" | "dark";
type TabOption = "utseende" | "profil" | "konto" | "admin";
type KontoSection = "personvern" | "billing";

type Props = {
  open: boolean;
  onClose: () => void;
  theme: ThemeOption;
  mode: ModeOption;
  onThemeChange: (theme: ThemeOption) => void;
  onModeChange: (mode: ModeOption) => void;
  isAdmin?: boolean;
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
  isAdmin = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabOption>("utseende");
  const [activeKontoSection, setActiveKontoSection] = useState<KontoSection>("personvern");
  const [profileName, setProfileName] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const showWip = () => window.alert("WIP");

  useEffect(() => {
    if (!open) return;
    setProfileName(getProfileName());
    setProfileSaved(false);
    setActiveTab("utseende");
    setActiveKontoSection("personvern");
  }, [open]);

  const saveProfile = () => {
    saveProfileName(profileName);
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
              aria-selected={activeTab === "konto"}
              className={`settingsTabButton ${activeTab === "konto" ? "is-active" : ""}`}
              onClick={() => setActiveTab("konto")}
            >
              Konto
            </button>
            {isAdmin && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "admin"}
                className={`settingsTabButton ${activeTab === "admin" ? "is-active" : ""}`}
                onClick={() => setActiveTab("admin")}
              >
                Admin
              </button>
            )}
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

            {activeTab === "konto" && (
              <div className="settingsSection">
                <div className="settingsSubTabs" role="tablist" aria-label="Konto seksjoner">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeKontoSection === "personvern"}
                    className={`settingsSubTabButton ${activeKontoSection === "personvern" ? "is-active" : ""}`}
                    onClick={() => setActiveKontoSection("personvern")}
                  >
                    Personvern
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeKontoSection === "billing"}
                    className={`settingsSubTabButton ${activeKontoSection === "billing" ? "is-active" : ""}`}
                    onClick={() => setActiveKontoSection("billing")}
                  >
                    Billing
                  </button>
                </div>

                {activeKontoSection === "personvern" && (
                  <div className="settingsActionList">
                    <button type="button" className="settingsActionItem" onClick={showWip}>
                      Slett mine data
                    </button>
                    <button type="button" className="settingsActionItem settingsActionItem--danger" onClick={showWip}>
                      Slett konto
                    </button>
                  </div>
                )}

                {activeKontoSection === "billing" && (
                  <div className="settingsAccountPlaceholder">
                    Billing er ikke satt opp enda. Administrasjon av abonnement og betaling kommer snart.
                  </div>
                )}
              </div>
            )}
            {activeTab === "admin" && (
              <div className="settingsSection">
                <div className="settingsActionList">
                  <button
                    type="button"
                    className="settingsActionItem"
                    onClick={() => { window.location.href = "/dashboard"; }}
                  >
                    Gå til Admin Dashboard
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
