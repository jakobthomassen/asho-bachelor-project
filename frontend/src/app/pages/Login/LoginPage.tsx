import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../../../config";
import {
  loginWithEmailPassword,
  registerWithEmailPassword,
} from "../../../features/auth/api";
import { renderGoogleButton } from "../../../features/auth/google";
import { useAuth } from "../../AuthProvider";
import "./LoginPage.css";

const AUTH_NEXT_PATH_KEY = "asho_auth_next_path";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isReady, error: authError, completeLogin } = useAuth();
  const googleHostRef = useRef<HTMLDivElement | null>(null);
  const next = searchParams.get("next") || "/";
  const isRegisterPage = searchParams.get("mode") === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem(AUTH_NEXT_PATH_KEY, next);
  }, [next]);

  useEffect(() => {
    if (!isReady || !googleHostRef.current) return;
    void renderGoogleButton(googleHostRef.current, {
      theme: "outline",
      size: "large",
      text: isRegisterPage ? "signup_with" : "signin_with",
      width: 320,
    });
  }, [isReady, isRegisterPage]);

  const startAppleAuth = () => {
    sessionStorage.setItem(AUTH_NEXT_PATH_KEY, next);
    const apiBase = API_BASE_URL ?? "";
    const returnTo = window.location.origin;
    window.location.href = `${apiBase}/api/auth/apple/start?return_to=${encodeURIComponent(returnTo)}`;
  };

  const handleContinue = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFormNotice(null);
    setFormError(null);

    try {
      if (isRegisterPage) {
        await registerWithEmailPassword(cleanEmail, password);
        setFormNotice("Konto opprettet. Logger inn...");
      }
      const auth = await loginWithEmailPassword(cleanEmail, password);
      completeLogin(auth);
      navigate(next, { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="welcomeAuth">
      <section className="welcomeAuth__panel">
        <h1 className="welcomeAuth__title">Velkommen til ASHO</h1>
        <p className="welcomeAuth__subtitle">
          ASHO er en trygg samtalepartner for struktur, refleksjon og stotte gjennom vanskelige perioder.
        </p>

        <div className="welcomeAuth__form">
          <input
            className="welcomeAuth__input"
            type="email"
            placeholder="Email Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="welcomeAuth__input"
            type="password"
            placeholder="Passord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegisterPage ? "new-password" : "current-password"}
          />

          <button
            type="button"
            className="welcomeAuth__primary"
            onClick={handleContinue}
            disabled={!email.trim() || !password.trim() || isSubmitting}
          >
            {isSubmitting ? "Sender..." : isRegisterPage ? "Opprett Konto" : "Logg Inn"}
          </button>
        </div>

        <div className="welcomeAuth__socials">
          <div ref={googleHostRef} className="welcomeAuth__googleHost" />
          <button type="button" className="welcomeAuth__apple" onClick={startAppleAuth}>
            <svg
              className="welcomeAuth__appleIcon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M16.37 12.06c.02 2.05 1.8 2.74 1.82 2.75-.01.04-.28.96-.91 1.9-.55.82-1.12 1.64-2.02 1.66-.88.02-1.17-.52-2.18-.52-1.02 0-1.34.5-2.15.54-.86.03-1.52-.86-2.07-1.67-1.12-1.62-1.97-4.58-.82-6.58.58-1 1.6-1.64 2.72-1.66.84-.02 1.64.56 2.16.56.52 0 1.5-.7 2.52-.6.43.02 1.63.17 2.4 1.3-.06.04-1.43.84-1.41 2.32zM14.77 5.4c.46-.56.78-1.34.69-2.12-.67.03-1.48.45-1.96 1-.43.5-.81 1.29-.71 2.05.75.06 1.52-.39 1.98-.93z" />
            </svg>
            {isRegisterPage ? "Sign up with Apple" : "Sign in with Apple"}
          </button>
        </div>

        {!isRegisterPage ? (
          <button
            type="button"
            className="welcomeAuth__link"
            onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}
          >
            Glemt passord?
          </button>
        ) : null}

        {!isRegisterPage ? (
          <button
            type="button"
            className="welcomeAuth__secondary"
            onClick={() => navigate(`/login?mode=register&next=${encodeURIComponent(next)}`)}
          >
            Opprett Konto
          </button>
        ) : null}

        {formNotice ? <p className="welcomeAuth__notice">{formNotice}</p> : null}
        {formError ? <p className="welcomeAuth__error">{formError}</p> : null}
        {authError ? <p className="welcomeAuth__error">{authError}</p> : null}

        <button type="button" className="welcomeAuth__link" onClick={() => navigate("/uro-skolen")}>
          Om Urometoden
        </button>
      </section>
    </main>
  );
}
