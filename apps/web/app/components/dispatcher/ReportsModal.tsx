"use client";

import "./modals/ReportsModal.css";

type ReportsModalProps = {
  onClose: () => void;
};

export default function ReportsModal({
  onClose,
}: ReportsModalProps) {
  return (
    <div className="reports-modal-overlay" onClick={onClose}>
      <div
        className="reports-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reports-item">
          <h3>Exception audit</h3>
          <p>
            Deferral reasons, repeat-deferral acknowledgements and
            delivery outcomes retained.
          </p>
        </div>

        <div className="reports-item">
          <h3>Revision audit</h3>
          <p>
            Revision 1 initial plan · Revision 2 operational changes.
          </p>
        </div>

        <div className="reports-actions">
          <button className="reports-primary">
            Preview CSV export →
          </button>

          <button>Preview PDF manifest</button>

          <button>View capacity forecast</button>
        </div>

        <button className="reports-close" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}