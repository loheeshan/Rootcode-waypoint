"use client";

import "./analytics.css";
import { useDispatcher } from "../../../features/dispatcher/components/DispatcherShell";
import { Alert, LoadError, Loading, useLoad } from "../../../features/dispatcher/components/ui";
import { getFleet, sumDecimals } from "../../../features/dispatcher/data/dispatcher";

/**
 * The API provides no demand forecast, utilisation or SLA metrics, so none are shown.
 * Only the configured fleet capacity (master data from /fleet) is real and listed here.
 */
export default function AnalyticsPage() {
  const { depotId, depots, onExpired } = useDispatcher();
  const fleet = useLoad(() => getFleet(depotId), onExpired, depotId);
  const groups = (["reefer", "ambient"] as const).flatMap((temperature) => (["van", "truck"] as const).map((type) => {
    const items = (fleet.data?.items ?? []).filter((v) => v.temperature_type === temperature && v.type === type);
    return {
      label: `${temperature === "reefer" ? "Reefer" : "Ambient"} ${type}s`,
      count: items.length,
      weight: sumDecimals(items.map((v) => v.weight_cap_kg)),
      volume: sumDecimals(items.map((v) => v.volume_cap_m3)),
      quota: sumDecimals(items.map((v) => v.weekly_fuel_quota_l)),
    };
  })).filter((g) => g.count);

  return (
    <main className="analytics-page">
      <header className="analytics-heading">
        <div className="analytics-title">
          <h1>Capacity</h1>
          <p>Configured fleet capacity for {depots.find((d) => d.id === depotId)?.name}.</p>
        </div>
      </header>

      <Alert k="w" t="Forecasts and utilisation are not available">
        The Waypoint API does not provide demand forecasts, fleet utilisation, on-time or SLA metrics, so this page
        shows none. Use Live Operations for today&apos;s real loading and delivery counts.
      </Alert>

      <section className="analytics-panel allocation-panel">
        <div className="allocation-heading">
          <div>
            <h2>Configured capacity by vehicle class</h2>
            <p>Sum of vehicle master data. Weekly quota is configured, not remaining fuel.</p>
          </div>
        </div>
        {fleet.loading ? <Loading /> : fleet.error ? <LoadError error={fleet.error} retry={fleet.reload} /> : (
          <div className="allocation-table-wrap">
            <table className="allocation-table">
              <thead>
                <tr><th>Vehicle class</th><th>Vehicles</th><th>Weight capacity</th><th>Volume capacity</th><th>Weekly fuel quota</th></tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.label}>
                    <td className="brand-name"><strong>{g.label}</strong></td>
                    <td>{g.count}</td><td>{g.weight} kg</td><td>{g.volume} m³</td><td>{g.quota} L</td>
                  </tr>
                ))}
                {!groups.length && <tr><td colSpan={5} className="no-allocation">This depot has no vehicles.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
