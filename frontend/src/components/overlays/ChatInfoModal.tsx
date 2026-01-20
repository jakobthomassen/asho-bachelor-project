type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ChatInfoModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="subscribeOverlay" onClick={onClose}>
      <div className="subscribeModal" onClick={(e) => e.stopPropagation()}>
        <h2 className="subscribeTitle">Chat</h2>

        <p className="subscribeText">
          <b>Start en samtale</b>
          <br />
          (lavterskel, 20 kr per samtale)
        </p>

        <button className="subscribeClose" onClick={onClose}>
          Lukk
        </button>
      </div>
    </div>
  );
}
