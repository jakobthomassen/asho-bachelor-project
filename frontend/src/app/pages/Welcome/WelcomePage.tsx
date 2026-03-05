import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../AuthProvider";
import { getProfileName } from "../../../features/profile/storage";
import "./WelcomePage.css";

export default function WelcomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sessionToken } = useAuth();
  const next = searchParams.get("next") || "/";
  const hasName = getProfileName().trim().length > 0;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!sessionToken) return;
    if (!hasName) {
      navigate("/onboarding", { replace: true });
      return;
    }
    navigate(next, { replace: true });
  }, [sessionToken, hasName, navigate, next]);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) return;
    navigate(`/login?next=${encodeURIComponent(next)}`);
  };

  const goToLogin = () => {
    navigate(`/login?next=${encodeURIComponent(next)}`);
  };

  const goToRegister = () => {
    navigate(`/login?mode=register&next=${encodeURIComponent(next)}`);
  };

  return (
    <main className="welcomeLanding">
      <section className="welcomeLanding__panel">
        <h1 className="welcomeLanding__title">Velkommen til ASHO</h1>
        <p className="welcomeLanding__subtitle">
          ASHO er en trygg samtalepartner for struktur, refleksjon og stotte gjennom vanskelige perioder.
        </p>

        <div className="welcomeLanding__form">
          <input
            className="welcomeLanding__input"
            type="email"
            placeholder="Email adresse"
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
            autoComplete="current-password"
          />

          <button type="button" className="welcomeLanding__primary" onClick={handleLogin}>
            Logg inn
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

        <button type="button" className="welcomeLanding__link" onClick={goToLogin}>
          Glemt passord?
        </button>

        <button type="button" className="welcomeLanding__secondary" onClick={goToRegister}>
          Ny konto
        </button>

        <button type="button" className="welcomeLanding__footerLink" onClick={() => navigate("/uro-skolen")}>
          Om Urometoden
        </button>
      </section>
    </main>
  );
}
