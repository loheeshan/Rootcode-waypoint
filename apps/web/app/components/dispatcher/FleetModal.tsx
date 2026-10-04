"use client";

import Link from "next/link";
import "./modals/FleetModal.css";
import { useDispatcher } from "../../../features/dispatcher/components/DispatcherShell";
import { LoadError, Loading, useLoad } from "../../../features/dispatcher/components/ui";
import { getFleet, vehicleLabel } from "../../../features/dispatcher/data/dispatcher";

type FleetModalProps = {
  onClose: () => void;
};

/** Vehicles of the selected depot as configured on the server (capacities are not remaining fuel). */
export default function FleetModal({ onClose }: FleetModalProps) {
  const { depotId, onExpired } = useDispatcher();
  const fleet = useLoad(() => getFleet(depotId), onExpired, depotId);

  return (
    <div className="fleet-modal-overlay" onClick={onClose}>
      <div
        className="fleet-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Fleet"
        onClick={(e) => e.stopPropagation()}
      >
        {fleet.loading ? <Loading t="Loading vehicles…" /> : fleet.error ? <LoadError error={fleet.error} retry={fleet.reload} /> : (
          fleet.data?.items.length ? fleet.data.items.map((vehicle) => (
            <div className="fleet-modal-item" key={vehicle.id}>
              <h3>{vehicleLabel(vehicle)}</h3>
              <p>
                {vehicle.weight_cap_kg} kg / {vehicle.volume_cap_m3} m³ · {vehicle.km_per_l} km/L ·
                weekly fuel quota {vehicle.weekly_fuel_quota_l} L (configured, not remaining)
              </p>
            </div>
          )) : <div className="fleet-modal-item"><h3>No vehicles</h3><p>This depot has no vehicles.</p></div>
        )}

        <div className="fleet-modal-actions">
          <Link className="fleet-primary" href="/dispatcher/fleet" onClick={onClose}>
            Availability and fuel inputs →
          </Link>
        </div>

        <button className="fleet-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
