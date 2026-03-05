import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../AuthProvider";
import {
  loginWithEmailPassword,
  registerWithEmailPassword,
} from "../../../features/auth/api";
import { renderGoogleButton } from "../../../features/auth/google";
import "../AuthFlow/AuthFlow.css";
import "../Welcome/WelcomePage.css";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isReady, error, completeLogin } = useAuth();
  const buttonHostRef = useRef<HTMLDivElement | null>(null);
  const queryMode = searchParams.get("mode");
  const initialMode: AuthMode = queryMode === "register" ? "register" : "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const next = searchParams.get("next") || "/";

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "register") {
      setMode("register");
      return;
    }
    setMode("login");
  }, [searchParams]);

  useEffect(() => {
    sessionStorage.setItem("asho_auth_next_path", next);
  }, [next]);

  useEffect(() => {
    if (!isReady || !buttonHostRef.current || mode !== "login") return;
    void renderGoogleButton(buttonHostRef.current, {
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      width: 320,
    });
  }, [isReady, mode]);

  const goToLogin = () => {
    navigate(`/login?next=${encodeURIComponent(next)}`);
  };

  const goToRegister = () => {
    navigate(`/login?mode=register&next=${encodeURIComponent(next)}`);
  };

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

  if (mode === "register") {
    return (
      <main className="welcomeLanding">
        <section className="welcomeLanding__panel welcomeLanding__panel--register">
          <h1 className="welcomeLanding__title">Velkommen til ASHO</h1>
          <p className="welcomeLanding__subtitle">
            ASHO er en trygg samtalepartner for struktur, refleksjon og stotte gjennom vanskelige perioder.
          </p>

          <div className="welcomeLanding__form">
            <input
              className="welcomeLanding__input"
              type="email"
              placeholder="Email Adresse"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className="welcomeLanding__input"
              type="password"
              placeholder="Passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <button
              type="button"
              className="welcomeLanding__primary"
              onClick={handleEmailPasswordContinue}
              disabled={!email.trim() || !password.trim() || isSubmitting}
            >
              {isSubmitting ? "Sender..." : "Opprett Konto"}
            </button>
          </div>

          <div className="welcomeLanding__socials">
            <button type="button" className="welcomeLanding__social" onClick={goToLogin}>
              Login with Google
            </button>
            <button type="button" className="welcomeLanding__social welcomeLanding__social--apple" onClick={goToLogin}>
              Sign in with Apple
            </button>
          </div>

          {!isReady && <p className="welcomeLanding__message">Laster Google innlogging...</p>}
          {formNotice ? <p className="welcomeLanding__message">{formNotice}</p> : null}
          {formError ? <p className="welcomeLanding__error">{formError}</p> : null}
          {error ? <p className="welcomeLanding__error">{error}</p> : null}

          <div className="welcomeLanding__spacer" />
          <button type="button" className="welcomeLanding__footerLink" onClick={() => navigate("/uro-skolen")}>
            Om Urometoden
          </button>
        </section>
      </main>
    );
  }

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

          <h1 className="authFlow__title authFlow__title--hero">Logg inn for a fortsette</h1>

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
                onClick={goToRegister}
                disabled={isSubmitting}
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
              autoComplete="current-password"
            />
            <button
              type="button"
              className="authFlow__button authFlow__button--primary authFlow__button--small"
              onClick={handleEmailPasswordContinue}
              disabled={!email.trim() || !password.trim() || isSubmitting}
            >
              {isSubmitting ? "Sender..." : "Fortsett"}
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
