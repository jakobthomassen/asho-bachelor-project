import { useNavigate } from "react-router-dom";
import "./UroSkolePage.css";

export default function UroSkolenPage() {
  const navigate = useNavigate();

  return (
    <div className="pageShell">
      <header className="pageHeader">
        <button className="backBtn" onClick={() => navigate(-1)}>
          ← Tilbake
        </button>

        <div className="pageHeader__titles">
          <h1 className="pageTitle">Uro-skolen</h1>
          <p className="pageSubtitle">Verktøy, forståelse og guiding for å håndtere uro</p>
        </div>
      </header>

      <main className="pageMain">
        <section className="heroCard">
          <h2 className="uroTitle">Start rolig. Bygg trygghet.</h2>
          <p className="uroText">
            Uro-skolen er laget for å være lavterskel og praktisk. Her kan du lære mer om hva uro er,
            hva som trigger den, og få små øvelser du kan bruke i hverdagen.
          </p>

          <div className="moduleList">
            <div className="moduleItem">
              <div className="moduleItem__kicker">Modul 1</div>
              <div className="moduleItem__title">Hva er uro?</div>
              <div className="moduleItem__text">Kort og tydelig introduksjon.</div>
            </div>

            <div className="moduleItem">
              <div className="moduleItem__kicker">Modul 2</div>
              <div className="moduleItem__title">Pust og regulering</div>
              <div className="moduleItem__text">Enkle øvelser for å roe kroppen.</div>
            </div>

            <div className="moduleItem">
              <div className="moduleItem__kicker">Modul 3</div>
              <div className="moduleItem__title">Tankemønstre</div>
              <div className="moduleItem__text">Hvordan møte tanker uten å bli overveldet.</div>
            </div>
          </div>

          <div className="ctaRow">
            <button className="primaryBtn" type="button">
              Åpne første modul (kommer)
            </button>
          </div>

          <div className="finePrint">
            Innholdet kommer senere, denne siden er en visuell “ramme” dere kan bygge videre på.
          </div>
        </section>
      </main>
    </div>
  );
}
