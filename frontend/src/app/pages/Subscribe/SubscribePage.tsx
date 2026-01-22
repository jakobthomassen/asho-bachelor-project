import { useNavigate } from "react-router-dom";
import "./SubscribePage.css";

export default function SubscribePage() {
  const navigate = useNavigate();

  return (
    <div className="pageShell">
      <header className="pageHeader">
        <button className="backBtn" onClick={() => navigate(-1)}>
          ← Tilbake
        </button>

        <div className="pageHeader__titles">
          <h1 className="pageTitle">Abonner</h1>
          <p className="pageSubtitle">Få tilgang til hele ASHO-opplevelsen</p>
        </div>
      </header>

      <main className="pageMain">
        <section className="heroCard">
          <div className="heroCard__badge">149 kr / mnd</div>
          <h2 className="heroCard__title">Abonner på ASHO</h2>
          <p className="heroCard__text">
            Tilgang til <b>lydfiler</b>, <b>guiding</b> og <b>Uro-skolen</b>.
          </p>

          <div className="featureGrid">
            <div className="featureItem">
              <div className="featureItem__title">Lydfiler</div>
              <div className="featureItem__text">Rolige øvelser og støtte du kan bruke når som helst.</div>
            </div>

            <div className="featureItem">
              <div className="featureItem__title">Guiding</div>
              <div className="featureItem__text">Små steg som hjelper deg å sortere tanker og følelser.</div>
            </div>

            <div className="featureItem">
              <div className="featureItem__title">Uro-skolen</div>
              <div className="featureItem__text">Verktøy og forståelse for å håndtere uro over tid.</div>
            </div>
          </div>

          <div className="ctaRow">
            <button className="primaryBtn" type="button">
              Fortsett
            </button>
          </div>

          <div className="finePrint">
            Dette er kun design foreløpig, betalingsflyt kan kobles på senere.
          </div>
        </section>
      </main>
    </div>
  );
}
