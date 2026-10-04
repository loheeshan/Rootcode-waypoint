
"use client";

import { useMemo, useState } from "react";
import "./analytics.css";

const weeks = [
  { week: "W40", dry: 85, chilled: 110, total: 195 },
  { week: "W41", dry: 0, chilled: 172.8, total: 172.8, risk: true },
  { week: "W42", dry: 65, chilled: 0, total: 65 },
  { week: "W43", dry: 100, chilled: 140, total: 240 },
  { week: "W44", dry: 60, chilled: 115, total: 175 },
  { week: "W45", dry: 65, chilled: 0, total: 65 },
  { week: "W46", dry: 65, chilled: 0, total: 65 },
  { week: "W47", dry: 80, chilled: 0, total: 80 },
  { week: "W48", dry: 65, chilled: 0, total: 65 },
  { week: "W49", dry: 0, chilled: 0, total: 0 },
];

const allocations = [
  {
    brand: "Cargills Fresh & Food City",
    depot: "Peliyagoda",
    total: 68.4,
    chilled: 68.4,
    reefers: 7,
    vans: 2,
    ratio: 108,
    color: "pink",
  },
  {
    brand: "Keells Supermarkets",
    depot: "Peliyagoda",
    total: 54.2,
    chilled: 54.2,
    reefers: 6,
    vans: 3,
    ratio: 94,
    color: "orange",
  },
  {
    brand: "Arpico Supercentres",
    depot: "Peliyagoda",
    total: 42.6,
    chilled: 28.5,
    reefers: 4,
    vans: 3,
    ratio: 82,
    color: "purple",
  },
  {
    brand: "Food City Regional",
    depot: "Kelaniya",
    total: 35.8,
    chilled: 20.4,
    reefers: 3,
    vans: 2,
    ratio: 76,
    color: "blue",
  },
];

type Alert = {
  level: "CRITICAL" | "WARNING" | "ADVISORY";
  week: string;
  date: string;
  title: string;
  description: string;
  action: string;
};

const alerts: Alert[] = [
  {
    level: "CRITICAL",
    week: "WEEK 41",
    date: "Oct 13 – Oct 19",
    title: "Peliyagoda Chilled Capacity Deficit",
    description:
      "Projected fresh demand of 172.8 m³ exceeds nominal capacity by 8.0%. All 16 assigned reefer vans fully locked.",
    action: "Queue Pre-Allocation Plan",
  },
  {
    level: "WARNING",
    week: "WEEK 43",
    date: "Oct 27 – Nov 02",
    title: "Deepavali Festival Superstore Surge",
    description:
      "Cargills & Keells superstore orders forecast at +35% dry grocery. Peliyagoda loading bay staging queues expected to exceed 45 mins.",
    action: "Adjust Dock Waves",
  },
  {
    level: "ADVISORY",
    week: "WEEK 48",
    date: "Nov 24 – Nov 30",
    title: "North-East Monsoon Transit Buffer",
    description:
      "Kandy & Central Corridor delivery runs require +15% travel time buffer due to rainfall risk. SLA breach risk on evening return routes.",
    action: "Review Fuel Caps",
  },
];

function downloadCSV() {
  const header = [
    "Brand",
    "Depot",
    "Total Volume (m3)",
    "Chilled Volume (m3)",
    "Reefer Units",
    "Dry Vans",
    "Load vs Capacity",
  ];

  const rows = allocations.map((item) => [
    item.brand,
    item.depot,
    item.total,
    item.chilled,
    item.reefers,
    item.vans,
    `${item.ratio}%`,
  ]);

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" })
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = "capacity-allocation.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [selectedWeek, setSelectedWeek] = useState("W41");
  const [weekRange, setWeekRange] = useState("40-49");
  const [depot, setDepot] = useState("Peliyagoda");
  const [brand, setBrand] = useState("All Brands");
  const [notice, setNotice] = useState("");
  const [stressTest, setStressTest] = useState(false);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [extraFleet, setExtraFleet] = useState(false);

  const filteredAllocations = useMemo(() => {
    return allocations.filter((item) => {
      const depotMatch =
        depot === "All Depots" || item.depot === depot;

      const brandMatch =
        brand === "All Brands" || item.brand === brand;

      return depotMatch && brandMatch;
    });
  }, [depot, brand]);

  const selected = weeks.find(
    (item) => item.week === selectedWeek
  );

  const peakDemand = selected?.total ?? 0;
  const reeferDemand = selected?.risk ? 172.8 : peakDemand;
  const capacity = 160;
  const deficit = Math.max(0, reeferDemand - capacity);

  const showNotice = (message: string) => setNotice(message);

  return (
    <main className="analytics-page">
      <header className="analytics-heading">
        <div className="analytics-title">
          <h1>
            Capacity Forecast
            <span className="illustrative-badge">
              Illustrative data · ISO weeks 40–49
            </span>
          </h1>
          <p>
            Forecast weekly volume per depot × brand against fleet
            capacity. Flagging scarce refrigerated capacity before
            paydays, festival ramps, and monsoons.
          </p>
        </div>

        <div className="analytics-controls">
          <select
            value={weekRange}
            onChange={(event) => setWeekRange(event.target.value)}
            aria-label="Forecast week range"
          >
            <option value="40-49">▦ Week 40 – Week 49 (Sep – Dec 2026)</option>
            <option value="40-44">Week 40 – Week 44</option>
            <option value="45-49">Week 45 – Week 49</option>
          </select>

          <select
            value={depot}
            onChange={(event) => setDepot(event.target.value)}
            aria-label="Select depot"
          >
            <option value="Peliyagoda">Depot: Peliyagoda Depot (Primary)</option>
            <option value="All Depots">Depot: All Depots</option>
            <option value="Kelaniya">Depot: Kelaniya Depot</option>
          </select>

          <div className="analytics-control-bottom">
            <select
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              aria-label="Select brand"
            >
              <option value="All Brands">
                Brand: All Brands (Cargills, Keells, Arpico)
              </option>
              {allocations.map((item) => (
                <option key={item.brand} value={item.brand}>
                  {item.brand}
                </option>
              ))}
            </select>

            <button
              className="analytics-primary"
              onClick={() => {
                setStressTest((value) => !value);
                showNotice(
                  stressTest
                    ? "Stress test disabled."
                    : "Stress test enabled: forecast demand increased by 15%."
                );
              }}
            >
              ↯ {stressTest ? "Reset Stress Test" : "Run Stress Test"}
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="analytics-notice" role="status">
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      <section className="forecast-stats">
        <article className="forecast-stat stat-critical">
          <div className="forecast-stat-label">
            PEAK REEFER DEMAND
            <span className="stat-icon red-icon">⚠</span>
          </div>
          <h2>{stressTest ? "125%" : "108%"}</h2>
          <span className="week-risk">Week 41 Risk</span>
          <p>
            {stressTest
              ? "Stress scenario exceeds normal fleet capacity."
              : "16/16 Reefer units exceeded (+12.8 m³ deficit)"}
          </p>
        </article>

        <article className="forecast-stat">
          <div className="forecast-stat-label">
            PROJECTED TOTAL VOLUME
            <span className="stat-icon blue-icon">⬡</span>
          </div>
          <h2>{stressTest ? "1,633" : "1,420"} m³</h2>
          <p>Avg 142 m³/week · {stressTest ? "97%" : "84%"} fleet utilization</p>
        </article>

        <article className="forecast-stat">
          <div className="forecast-stat-label">
            CHILLED / FRESH SHARE
            <span className="stat-icon cyan-icon">✳</span>
          </div>
          <h2 className="cyan-text">62%</h2>
          <p>Fresh Food City & Cargills drive 880 m³ total</p>
        </article>

        <article className="forecast-stat">
          <div className="forecast-stat-label">
            SCHEDULED EVENT SPIKES
            <span className="stat-icon orange-icon">◷</span>
          </div>
          <h2 className="orange-text">3 Events</h2>
          <p>W41 Payday, W43 Deepavali, W48 Monsoon Ramp</p>
        </article>
      </section>

      <section className="analytics-main-grid">
        <article className="analytics-panel forecast-chart-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Weekly Volume vs Fleet Ceiling (m³)</h2>
              <p>
                10-week trajectory displaying Peliyagoda Reefer limit
                (160 m³) & Dry van limit
              </p>
            </div>

            <div className="chart-legend">
              <span><i className="legend-dry" />Dry Volume</span>
              <span><i className="legend-chilled" />Chilled Fresh</span>
              <span><i className="legend-reefer" />Reefer Cap (160 m³)</span>
              <span><i className="legend-total" />Total Cap (580 m³)</span>
            </div>
          </div>

          <div className="event-markers">
            <span className="event-payday">● W41: Month-End Payday</span>
            <span className="event-festival">● W43: Deepavali Festival Peak</span>
            <span className="event-monsoon">● W48: Monsoon Buffer (+15% Transit)</span>
          </div>

          <div className="forecast-chart">
            <div className="chart-ceiling-label">Total Fleet Ceiling: 580 m³</div>
            <div className="chart-bars">
              <div className="chart-gridline gridline-one" />
              <div className="chart-gridline gridline-two" />
              <div className="chart-gridline gridline-three" />

              <div className="reefer-limit-line">
                <span>Reefer Max Ceiling: 160 m³ (16 Trucks)</span>
              </div>

              {(weekRange === "40-49"
                ? weeks
                : weeks.filter((item) =>
                    weekRange === "40-44"
                      ? Number(item.week.slice(1)) <= 44
                      : Number(item.week.slice(1)) >= 45
                  )
              ).map((item) => {
                const total = stressTest
                  ? item.total * 1.15
                  : item.total;

                const chilledHeight = Math.min(
                  100,
                  (item.chilled / 300) * 100
                );

                const dryHeight = Math.min(
                  100 - chilledHeight,
                  (item.dry / 300) * 100
                );

                const totalHeight = Math.min(
                  100,
                  (total / 300) * 100
                );

                return (
                  <button
                    key={item.week}
                    className={`forecast-bar-column ${
                      selectedWeek === item.week ? "bar-selected" : ""
                    } ${item.risk ? "bar-risk" : ""}`}
                    onClick={() => setSelectedWeek(item.week)}
                    aria-label={`${item.week}, ${total.toFixed(1)} cubic metres`}
                  >
                    <div className="bar-plot">
                      {item.risk && (
                        <span className="bar-value-label">
                          {reeferDemand} m³
                        </span>
                      )}
                      <div
                        className="forecast-bar"
                        style={{ height: `${totalHeight}%` }}
                      >
                        <div
                          className="bar-dry"
                          style={{ height: `${dryHeight}%` }}
                        />
                        <div
                          className={`bar-chilled ${
                            item.risk ? "chilled-risk" : ""
                          }`}
                          style={{ height: `${chilledHeight}%` }}
                        />
                      </div>
                    </div>
                    <span className="bar-week">{item.week}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="peak-breakdown">
            <span className="breakdown-icon">◴</span>
            <div className="breakdown-copy">
              <h3>{selectedWeek} Peak Payday Impact Breakdown</h3>
              <p>
                Reefer demand reaches {reeferDemand.toFixed(1)} m³ against
                160.0 m³ ceiling. Net deficit: {deficit.toFixed(1)} m³
                (equivalent to {Math.ceil(deficit / 6)} reefer multi-drop
                runs).
              </p>
            </div>
            <button
              className="outline-danger"
              onClick={() => {
                setExtraFleet((value) => !value);
                showNotice(
                  extraFleet
                    ? "Additional fleet scenario removed."
                    : "Additional fleet scenario added for evaluation."
                );
              }}
            >
              {extraFleet ? "Remove Fleet Scenario" : "Simulate Fleet Addition"}
            </button>
          </div>

          {extraFleet && (
            <div className="fleet-scenario">
              <strong>Fleet addition scenario</strong>
              <span>2 additional refrigerated vehicles proposed.</span>
              <span>Review operating costs before confirming allocation.</span>
            </div>
          )}
        </article>

        <aside className="analytics-panel bottlenecks-panel">
          <div className="bottleneck-heading">
            <h2>Bottlenecks & Mitigation</h2>
            <span>3 ACTIVE</span>
          </div>

          {alerts.map((alert) => (
            <article
              className={`bottleneck-card bottleneck-${alert.level.toLowerCase()}`}
              key={alert.level}
            >
              <div className="bottleneck-meta">
                <span>{alert.level} · {alert.week}</span>
                <time>{alert.date}</time>
              </div>

              <h3>{alert.title}</h3>
              <p>{alert.description}</p>

              {alert.level === "CRITICAL" && (
                <div className="suggested-action">
                  <strong>Suggested Action:</strong> Advance non-perishables
                  by 48 hrs or requisition 2 reefers from Kelaniya backup fleet.
                </div>
              )}

              <button
                className={`bottleneck-action action-${alert.level.toLowerCase()}`}
                onClick={() => setActiveAlert(alert)}
              >
                {alert.action}
              </button>
            </article>
          ))}
        </aside>
      </section>

      <section className="analytics-panel allocation-panel">
        <div className="allocation-heading">
          <div>
            <h2>
              Capacity Allocation by Brand & Depot ({selectedWeek} Peak)
            </h2>
            <p>
              Breakdown of order commitments against vehicle class
              assignments for {depot === "All Depots" ? "all depots" : depot}
            </p>
          </div>

          <div className="allocation-export">
            <span>Export view:</span>
            <button onClick={downloadCSV}>CSV</button>
            <button
              onClick={() =>
                showNotice(
                  "Print the allocation table or use your browser's Save as PDF option."
                )
              }
            >
              PDF Manifest
            </button>
          </div>
        </div>

        <div className="allocation-table-wrap">
          <table className="allocation-table">
            <thead>
              <tr>
                <th>Brand Customer</th>
                <th>Primary Depot</th>
                <th>Total Vol (m³)</th>
                <th>Chilled Vol (m³)</th>
                <th>Reefer Units Req.</th>
                <th>Dry Van Req.</th>
                <th>Load vs Cap Ratio</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllocations.map((item) => (
                <tr key={item.brand}>
                  <td className="brand-name">
                    <span className={`brand-dot dot-${item.color}`} />
                    <strong>{item.brand}</strong>
                  </td>
                  <td>{item.depot}</td>
                  <td><strong>{item.total.toFixed(1)} m³</strong></td>
                  <td className="chilled-cell">
                    {item.chilled.toFixed(1)} m³
                  </td>
                  <td>
                    <span className="unit-pill">
                      {item.reefers} Reefers
                    </span>
                  </td>
                  <td>{item.vans} Vans</td>
                  <td>
                    <span
                      className={`capacity-ratio ${
                        item.ratio >= 100
                          ? "ratio-danger"
                          : item.ratio >= 90
                            ? "ratio-warning"
                            : "ratio-good"
                      }`}
                    >
                      {item.ratio >= 100
                        ? "Over Cap"
                        : item.ratio >= 90
                          ? "High Pressure"
                          : "Healthy"}{" "}
                      ({item.ratio}%)
                    </span>
                  </td>
                  <td>
                    <button
                      className="table-action"
                      onClick={() =>
                        showNotice(
                          `${item.brand}: allocation details selected.`
                        )
                      }
                    >
                      {item.ratio >= 100 ? "Re-route" : "Details"} →
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAllocations.length === 0 && (
                <tr>
                  <td colSpan={8} className="no-allocation">
                    No allocation records match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeAlert && (
        <div
          className="analytics-modal-overlay"
          onClick={() => setActiveAlert(null)}
        >
          <section
            className="analytics-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="analytics-modal-close"
              onClick={() => setActiveAlert(null)}
              aria-label="Close"
            >
              ×
            </button>

            <span className={`modal-level level-${activeAlert.level.toLowerCase()}`}>
              {activeAlert.level} · {activeAlert.week}
            </span>
            <h2 id="alert-modal-title">{activeAlert.title}</h2>
            <p>{activeAlert.description}</p>
            <div className="modal-recommendation">
              <strong>Recommended action</strong>
              <p>{activeAlert.action}</p>
              <small>
                This demonstration does not dispatch vehicles or modify
                actual fleet assignments.
              </small>
            </div>
            <button
              className="analytics-primary modal-confirm"
              onClick={() => {
                showNotice(
                  `${activeAlert.action}: added to the local review queue.`
                );
                setActiveAlert(null);
              }}
            >
              Add to Review Queue
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

