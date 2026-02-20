import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../AuthProvider";
import { clickRenderedButton, renderGoogleButton } from "../../../features/auth/google";
import "../AuthFlow/AuthFlow.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isReady, error } = useAuth();
  const buttonHostRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const next = searchParams.get("next") || "/";

  useEffect(() => {
    sessionStorage.setItem("asho_auth_next_path", next);
  }, [next]);

  useEffect(() => {
    if (!isReady || !buttonHostRef.current) return;
    void renderGoogleButton(buttonHostRef.current, {
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      width: 280,
    });
  }, [isReady]);

  const handleEmailPasswordContinue = () => {
    if (!email.trim() || !password.trim()) return;
    setFormNotice("E-post/passord er ikke aktivert ennå. Bruk Google-knappen under.");
  };

  const handleGoogle = () => {
    if (!buttonHostRef.current) return;
    clickRenderedButton(buttonHostRef.current);
  };

  return (
    <main className="authFlow">
      <section className="authFlow__card authFlow__card--hero">
        <h1 className="authFlow__title authFlow__title--hero">Logg inn for a fortsette</h1>

        <div className="authFlow__form">
          <label className="authFlow__fieldLabel" htmlFor="login-email">
            E-post
          </label>
          <input
            id="login-email"
            className="authFlow__input authFlow__input--compact"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <label className="authFlow__fieldLabel" htmlFor="login-password">
            Passord
          </label>
          <div className="authFlow__formRow">
            <input
              id="login-password"
              className="authFlow__input authFlow__input--compact"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="authFlow__button authFlow__button--primary authFlow__button--small"
              onClick={handleEmailPasswordContinue}
              disabled={!email.trim() || !password.trim()}
            >
              Fortsett
            </button>
          </div>
        </div>

        <div className="authFlow__divider" />

        <div className="authFlow__socials">
          <button type="button" className="authFlow__social authFlow__social--apple" disabled>
            Continue with Apple
          </button>

          <button type="button" className="authFlow__social authFlow__social--google" onClick={handleGoogle}>
            Continue with Google
          </button>
          <div ref={buttonHostRef} className="authFlow__googleHost" />
        </div>

        {!isReady && <p className="authFlow__text">Laster Google innlogging...</p>}
        {formNotice ? <p className="authFlow__text">{formNotice}</p> : null}
        {error ? <p className="authFlow__error">{error}</p> : null}

        <div className="authFlow__footer">
          <button type="button" className="authFlow__link" onClick={() => navigate(`/welcome?next=${encodeURIComponent(next)}`)}>
            Tilbake
          </button>
        </div>
      </section>
    </main>
  );
}
