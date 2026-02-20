import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfileName, saveProfileName } from "../../../features/profile/storage";
import "../AuthFlow/AuthFlow.css";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => getProfileName());
  const [touched, setTouched] = useState(false);

  const canContinue = useMemo(() => name.trim().length > 0, [name]);

  const handleContinue = () => {
    setTouched(true);
    if (!canContinue) return;
    saveProfileName(name);
    navigate("/");
  };

  return (
    <main className="authFlow">
      <section className="authFlow__card">
        <h1 className="authFlow__title">Velkommen!</h1>
        <p className="authFlow__text">Hva skal ASHO kalle deg?</p>

        <input
          className="authFlow__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Skriv navn"
          maxLength={60}
        />

        {touched && !canContinue ? (
          <p className="authFlow__error">Skriv inn et navn for a fortsette.</p>
        ) : null}

        <div className="authFlow__actions">
          <button type="button" className="authFlow__button authFlow__button--primary" onClick={handleContinue}>
            Fortsett til chat
          </button>
        </div>
      </section>
    </main>
  );
}
