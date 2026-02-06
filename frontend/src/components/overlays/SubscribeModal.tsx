import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SubscribeModal({ open, onClose }: Props) {
  const navigate = useNavigate();

  if (!open) return null;

  const goToSubscribe = () => {
    onClose();
    navigate("/subscribe");
  };

  return (
    <div className="subscribeOverlay" onClick={onClose}>
      <div className="subscribeModal" onClick={(e) => e.stopPropagation()}>
        <h2 className="subscribeTitle">Abonner på ASHO</h2>

        <p className="subscribeText">
          <b>149 kr / mnd</b>
          <br />
          Tilgang til lydfiler, guiding og Uro-skolen
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="subscribeClose" onClick={goToSubscribe}>
            Gå til abonnement
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
