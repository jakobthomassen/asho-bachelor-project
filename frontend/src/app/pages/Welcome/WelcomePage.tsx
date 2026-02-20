import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../AuthProvider";
import { getProfileName } from "../../../features/profile/storage";
import "../AuthFlow/AuthFlow.css";

export default function WelcomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sessionToken } = useAuth();

  const next = searchParams.get("next") || "/";
  const hasName = getProfileName().trim().length > 0;

  useEffect(() => {
    if (!sessionToken) return;
    if (!hasName) {
      navigate("/onboarding", { replace: true });
      return;
    }
    navigate(next, { replace: true });
  }, [sessionToken, hasName, navigate, next]);

  const handleStart = () => {
    if (!sessionToken) {
      navigate(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!hasName) {
      navigate("/onboarding");
      return;
    }
    navigate(next);
  };

  return (
    <main className="authFlow">
      <section className="authFlow__card">
        <h1 className="authFlow__title">Velkommen til ASHO</h1>
        <p className="authFlow__text">
          ASHO er en trygg samtalepartner for struktur, refleksjon og støtte gjennom vanskelige perioder.
        </p>

        <div className="authFlow__plans">
          <article className="authFlow__plan">
            <h2 className="authFlow__planTitle">Gratis prøve</h2>
            <p className="authFlow__planText">Prøv samtaleopplevelsen og bli kjent med hvordan ASHO hjelper deg.</p>
          </article>
          <article className="authFlow__plan">
            <h2 className="authFlow__planTitle">Plan-info</h2>
            <p className="authFlow__planText">Betaling er deaktivert i denne versjonen. Fokus er innlogging og chat-flyt.</p>
          </article>
        </div>

        <div className="authFlow__actions">
          <button type="button" className="authFlow__button authFlow__button--primary" onClick={handleStart}>
            Start gratis prove
          </button>
        </div>
      </section>
    </main>
  );
}
