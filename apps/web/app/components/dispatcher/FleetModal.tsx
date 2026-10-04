"use client";

import "./modals/FleetModal.css";

type FleetModalProps = {
  onClose: () => void;
};

export default function FleetModal({ onClose }: FleetModalProps) {
  return (
    <div className="fleet-modal-overlay" onClick={onClose}>
      <div
        className="fleet-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fleet-modal-item">
          <h3>Peliyagoda · VEH-018</h3>
          <p>
            Reefer · 3,000 kg / 18 m³ · 42 L fuel remaining ·
            Fresh time budget 270 min.
          </p>
        </div>

        <div className="fleet-modal-item">
          <h3>Kandy · VEH-044</h3>
          <p>
            Home depot: Kandy. Cannot serve Peliyagoda orders.
          </p>
        </div>

        <div className="fleet-modal-item fleet-danger">
          <h3>Workshop · VEH-022</h3>
          <p>
            Unavailable after 04:40. Excluded from allocation.
          </p>
        </div>

        <div className="fleet-modal-actions">
          <button className="fleet-primary">
            Assign available vehicle →
          </button>

          <button>Workshop details</button>

          <button>Depot filters</button>
        </div>

        <button className="fleet-close" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}