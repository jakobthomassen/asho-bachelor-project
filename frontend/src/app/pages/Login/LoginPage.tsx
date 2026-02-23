import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../AuthProvider";
import {
  loginWithEmailPassword,
  registerWithEmailPassword,
} from "../../../features/auth/api";
import { renderGoogleButton } from "../../../features/auth/google";
import "../AuthFlow/AuthFlow.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isReady, error, completeLogin } = useAuth();
  const buttonHostRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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
      width: 320,
    });
  }, [isReady]);

  const handleEmailPasswordContinue = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFormNotice(null);
    setFormError(null);

    try {
      if (mode === "register") {
        await registerWithEmailPassword(cleanEmail, password);
        setFormNotice("Konto opprettet. Logger inn...");
      }

      const auth = await loginWithEmailPassword(cleanEmail, password);
      completeLogin(auth);
      navigate(next, { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Noe gikk galt under innlogging");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="authFlow">
      <section className="authFlow__card authFlow__card--hero">
        <div className="authFlow__contentCard">
          <button
            type="button"
            className="authFlow__back"
            onClick={() => navigate(`/welcome?next=${encodeURIComponent(next)}`)}
          >
            {"<- Tilbake"}
          </button>

          <h1 className="authFlow__title authFlow__title--hero">
            {mode === "register" ? "Opprett konto" : "Logg inn for a fortsette"}
          </h1>

          <div className="authFlow__form">
            <div className="authFlow__actions">
              <button
                type="button"
                className="authFlow__button authFlow__button--small"
                onClick={() => setMode("login")}
                disabled={isSubmitting || mode === "login"}
              >
                Logg inn
              </button>
              <button
                type="button"
                className="authFlow__button authFlow__button--secondary authFlow__button--small"
                onClick={() => setMode("register")}
                disabled={isSubmitting || mode === "register"}
              >
                Opprett konto
              </button>
            </div>

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
            <input
              id="login-password"
              className="authFlow__input authFlow__input--compact"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              className="authFlow__button authFlow__button--primary authFlow__button--small"
              onClick={handleEmailPasswordContinue}
              disabled={!email.trim() || !password.trim() || isSubmitting}
            >
              {isSubmitting ? "Sender..." : mode === "register" ? "Opprett konto" : "Fortsett"}
            </button>
          </div>

          <div className="authFlow__divider" />

          <div className="authFlow__socials">
            <button type="button" className="authFlow__social authFlow__social--apple" disabled>
              Sign in with Apple
            </button>

            <div ref={buttonHostRef} className="authFlow__googleHost" />
          </div>

          {!isReady && <p className="authFlow__text">Laster Google innlogging...</p>}
          {formNotice ? <p className="authFlow__text">{formNotice}</p> : null}
          {formError ? <p className="authFlow__error">{formError}</p> : null}
          {error ? <p className="authFlow__error">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}

