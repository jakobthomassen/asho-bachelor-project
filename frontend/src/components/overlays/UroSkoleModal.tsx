import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function UroSkolenModal({ open, onClose }: Props) {
  const navigate = useNavigate();

  if (!open) return null;

  const goToUroSkolen = () => {
    onClose();
    navigate("/uro-skolen");
  };

  return (
    <div className="subscribeOverlay" onClick={onClose}>
      <div className="subscribeModal" onClick={(e) => e.stopPropagation()}>
        <h2 className="subscribeTitle">Uro-skolen</h2>

        <p className="subscribeText">
          Her finner du guiding og verktøy som kan hjelpe deg å forstå og håndtere uro.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="subscribeClose" onClick={goToUroSkolen}>
            Åpne Uro-skolen
          </button>

          <button
            className="subscribeClose"
            style={{ background: "var(--surface)", color: "var(--text-primary)" }}
            onClick={onClose}
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
}
