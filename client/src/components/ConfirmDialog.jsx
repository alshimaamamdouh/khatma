function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel, danger = false }) {
  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true">
      <div className="confirm-box">
        <p className="confirm-message">{message}</p>
        <button className={`btn btn-big ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn btn-big btn-secondary" onClick={onCancel}>
          لا
        </button>
      </div>
    </div>
  );
}

export default ConfirmDialog;
