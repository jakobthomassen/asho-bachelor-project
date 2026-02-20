import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../AuthProvider";
import { getProfileName } from "../../../features/profile/storage";
import "../AuthFlow/AuthFlow.css";

export default function WelcomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sessionToken } = useAuth();
  const [step, setStep] = useState<"intro" | "trial">("intro");

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

  const handleCreateAccount = () => {
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
      <section className="authFlow__card authFlow__card--hero">
        <div className="authFlow__contentCard">
          {step === "trial" ? (
            <button type="button" className="authFlow__back" onClick={() => setStep("intro")}>
              ← Tilbake
            </button>
          ) : null}

          {step === "intro" ? (
            <>
              <h1 className="authFlow__title authFlow__title--hero">Velkommen til ASHO</h1>
              <p className="authFlow__text authFlow__text--hero">
                ASHO er en trygg samtalepartner for struktur, refleksjon og stotte gjennom vanskelige perioder.
              </p>

              <div className="authFlow__stack">
                <button
                  type="button"
                  className="authFlow__button authFlow__button--primary authFlow__button--wide"
                  onClick={() => setStep("trial")}
                >
                  Fortsett
                </button>
                <p className="authFlow__hint">Eksisterende bruker?</p>
                <button
                  type="button"
                  className="authFlow__button authFlow__button--secondary authFlow__button--wide"
                  onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}
                >
                  Logg inn
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="authFlow__title authFlow__title--hero">Gratis proveperiode</h1>
              <p className="authFlow__text authFlow__text--hero">
                Opprett en konto med Google for a starte proveperioden og komme rett inn i chatten.
              </p>

              <div className="authFlow__stack">
                <button
                  type="button"
                  className="authFlow__button authFlow__button--primary authFlow__button--wide"
                  onClick={handleCreateAccount}
                >
                  Opprett konto
                </button>
              </div>
            </>
          )}
        </div>

        <div className="authFlow__footer">
          <button type="button" className="authFlow__link" onClick={() => navigate("/uro-skolen")}>
            Om Urometoden
          </button>
        </div>
      </section>
    </main>
  );
}
