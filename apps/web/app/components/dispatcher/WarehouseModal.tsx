"use client";

import "./modals/WarehouseModal.css";
import { useDispatcher } from "../../../features/dispatcher/components/DispatcherShell";

type WarehouseModalProps = {
  onClose: () => void;
};

/** Depots assigned to this Dispatcher; choosing one scopes every Dispatcher page. */
export default function WarehouseModal({
  onClose,
}: WarehouseModalProps) {
  const { depots, depotId, setDepotId } = useDispatcher();
  return (
    <div className="warehouse-modal-overlay" onClick={onClose}>
      <div
        className="warehouse-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Depots"
        onClick={(e) => e.stopPropagation()}
      >
        {depots.map((depot) => (
          <div className="warehouse-item" key={depot.id}>
            <h3>{depot.name}{depot.id === depotId ? " · selected" : ""}</h3>
            <p>Depot {depot.id.slice(0, 8).toUpperCase()}</p>
          </div>
        ))}

        <div className="warehouse-actions">
          {depots.filter((depot) => depot.id !== depotId).map((depot) => (
            <button key={depot.id} onClick={() => { setDepotId(depot.id); onClose(); }}>
              Switch to {depot.name}
            </button>
          ))}
        </div>

        <button className="warehouse-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
