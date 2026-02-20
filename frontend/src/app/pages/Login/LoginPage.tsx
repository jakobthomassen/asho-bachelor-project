import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthProvider";
import { renderGoogleButton } from "../../../features/auth/google";
import "../AuthFlow/AuthFlow.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isReady, error } = useAuth();
  const buttonHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isReady || !buttonHostRef.current) return;
    void renderGoogleButton(buttonHostRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      width: 260,
    });
  }, [isReady]);

  return (
    <main className="authFlow">
      <section className="authFlow__card">
        <h1 className="authFlow__title">Logg inn for a starte</h1>
        <p className="authFlow__text">For a bruke ASHO ma du logge inn med Google.</p>

        <div className="authFlow__actions">
          <div ref={buttonHostRef} />
          <button type="button" className="authFlow__button" onClick={() => navigate("/welcome")}>
            Tilbake
          </button>
        </div>

        {!isReady && <p className="authFlow__text">Laster Google innlogging...</p>}
        {error ? <p className="authFlow__error">{error}</p> : null}
      </section>
    </main>
  );
}
