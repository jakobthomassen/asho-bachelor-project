import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ResourcesModal({ open, onClose }: Props) {
  const navigate = useNavigate();

  if (!open) return null;

  const goToSound = () => {
    onClose();
    navigate("/soundtest");
  };

  const goToUroSkolen = () => {
    onClose();
    navigate("/uro-skolen");
  };

  return (
    <div className="subscribeOverlay" onClick={onClose}>
      <div className="subscribeModal resourcesModal" onClick={(e) => e.stopPropagation()}>
        <h2 className="subscribeTitle">Ressurser</h2>

        <p className="subscribeText">
          Velg en ressurs du vil apne.
        </p>

        <div className="resourcesModal__actions">
          <button className="subscribeClose" onClick={goToSound}>
            Lydovelser
          </button>
          <button className="subscribeClose" onClick={goToUroSkolen}>
            Uro-skolen
          </button>
        </div>

        <div className="settingsActions">
          <button className="subscribeClose" onClick={onClose}>
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
}
