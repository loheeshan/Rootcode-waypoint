"use client";

import "./modals/WarehouseModal.css";

type WarehouseModalProps = {
  onClose: () => void;
};

export default function WarehouseModal({
  onClose,
}: WarehouseModalProps) {
  return (
    <div className="warehouse-modal-overlay" onClick={onClose}>
      <div
        className="warehouse-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="warehouse-item">
          <h3>Kandy · dispatch floor</h3>
          <p>
            8 trips prepared · 1 offline driver awaiting reconnect
          </p>
        </div>

        <div className="warehouse-item">
          <h3>Revision safeguards</h3>
          <p>
            Already loaded stops are frozen. Changed manifests
            require loader acknowledgement.
          </p>
        </div>

        <div className="warehouse-actions">
          <button className="warehouse-primary">
            Adjust dock waves →
          </button>

          <button>Open loading issue</button>

          <button>View publication</button>
        </div>

        <button className="warehouse-close" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}