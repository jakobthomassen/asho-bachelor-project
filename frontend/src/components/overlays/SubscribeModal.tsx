type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SubscribeModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="subscribeOverlay" onClick={onClose}>
      <div
        className="subscribeModal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="subscribeTitle">Abonner på ASHO</h2>

        <p className="subscribeText">
          <b>149 kr / mnd</b>
          <br />
          Tilgang til lydfiler, guiding og Uro-skolen
        </p>

        <button className="subscribeClose" onClick={onClose}>
          Lukk
        </button>
      </div>
    </div>
  );
}
