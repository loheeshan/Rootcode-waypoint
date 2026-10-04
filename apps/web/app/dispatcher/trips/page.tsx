
"use client";

import { useMemo, useState } from "react";
import "./trips.css";

type TripStatus =
  | "On Schedule"
  | "Late Risk"
  | "Issue"
  | "Offline";

type Trip = {
  id: string;
  route: string;
  driver: string;
  depot: string;
  status: TripStatus;
  completed: number;
  total: number;
  next: string;
  eta: string;
};

const trips: Trip[] = [
  {
    id: "VEH-018",
    route: "Trip 1",
    driver: "Kasun Perera",
    depot: "Colombo",
    status: "On Schedule",
    completed: 3,
    total: 6,
    next: "Cargills - Kandy",
    eta: "10:00 AM",
  },
  {
    id: "VEH-033",
    route: "Trip 1",
    driver: "Nimal Silva",
    depot: "Colombo",
    status: "Late Risk",
    completed: 4,
    total: 5,
    next: "Lanka Pharmacy",
    eta: "11:30 AM",
  },
  {
    id: "VEH-044",
    route: "Trip 1",
    driver: "Amal Fernando",
    depot: "Colombo",
    status: "Issue",
    completed: 2,
    total: 5,
    next: "City Hardware",
    eta: "12:10 PM",
  },
  {
    id: "VEH-052",
    route: "Trip 2",
    driver: "Saman Kumara",
    depot: "Jaffna",
    status: "Offline",
    completed: 2,
    total: 6,
    next: "Jaffna",
    eta: "Unknown",
  },
  {
    id: "VEH-021",
    route: "Trip 2",
    driver: "Dilan Jay",
    depot: "Colombo",
    status: "Issue",
    completed: 1,
    total: 4,
    next: "Peliyagoda",
    eta: "12:40 PM",
  },
];

const exceptions = [
  {
    time: "08:52",
    type: "LOADER",
    severity: "SHORTFALL",
    vehicle: "VEH-044 · ORD-7786",
    description:
      "2 cartons missing from ORD-7786 at Peliyagoda dock",
  },
  {
    time: "09:14",
    type: "DRIVER",
    severity: "PARTIAL DELIVERY",
    vehicle: "VEH-033 · ORD-7789",
    description:
      "8 / 10 items delivered; 2 items unavailable at outlet",
  },
  {
    time: "09:37",
    type: "DRIVER",
    severity: "NOT DELIVERED",
    vehicle: "VEH-021 · ORD-7794",
    description:
      "Outlet closed upon driver arrival; action required",
  },
  {
    time: "09:48",
    type: "STORE MANAGER",
    severity: "RECEIPT ISSUE",
    vehicle: "ORD-7791 · Lanka Pharm.",
    description:
      "Store manager reported quantity discrepancy on signed invoice",
  },
];

const filters = [
  "All",
  "On Time",
  "In Progress",
  "Late Risk",
  "Issues",
  "Offline",
];

export default function TripsPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [depot, setDepot] = useState("All Depots");
  const [selectedTrip, setSelectedTrip] = useState("VEH-018");
  const [lastRefresh, setLastRefresh] = useState("11:42 AM");
  const [notice, setNotice] = useState("");
  const [openException, setOpenException] = useState<
    (typeof exceptions)[number] | null
  >(null);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const matchesSearch =
        `${trip.id} ${trip.driver} ${trip.next} ${trip.route}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesDepot =
        depot === "All Depots" || trip.depot === depot;

      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "On Time" &&
          trip.status === "On Schedule") ||
        (activeFilter === "In Progress" &&
          trip.completed > 0 &&
          trip.status !== "Offline") ||
        (activeFilter === "Late Risk" &&
          trip.status === "Late Risk") ||
        (activeFilter === "Issues" &&
          trip.status === "Issue") ||
        (activeFilter === "Offline" &&
          trip.status === "Offline");

      return matchesSearch && matchesDepot && matchesFilter;
    });
  }, [activeFilter, search, depot]);

  const selected = trips.find(
    (trip) => trip.id === selectedTrip
  );

  const showNotice = (message: string) => {
    setNotice(message);
  };

  return (
    <main className="trips-page">
      <header className="trips-heading">
        <div>
          <div className="trips-breadcrumb">
            OPERATIONS <span>/</span> <b>Trips</b>
          </div>
          <h1>
            Live Operations
            <span className="dispatch-badge">
              FLEET DISPATCH
            </span>
          </h1>
          <p>
            Monitor active trips, delivery progress and field
            exceptions in real time.
          </p>
        </div>

        <div className="trips-actions">
          <button
            className="trip-button"
            onClick={() =>
              showNotice("Showing operational date: Sep 25, 2026")
            }
          >
            ▣ Today: Sep 25, 2026
          </button>

          <button
            className="trip-button"
            onClick={() => {
              setLastRefresh(
                new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              );
              showNotice("Dashboard refreshed.");
            }}
          >
            ↻ Manual Refresh
          </button>

          <button
            className="trip-button trip-primary"
            onClick={() =>
              showNotice(
                "Fleet note composer is ready. Connect your broadcast API to send notes."
              )
            }
          >
            ▣ Broadcast Fleet Note
          </button>
        </div>
      </header>

      <section className="live-strip">
        <span className="live-dot" />
        <strong>LIVE OPERATIONS</strong>
        <span>·</span>
        <b>18</b> active trips
        <span>·</span>
        <b className="green-text">31</b> stops completed
        <span>·</span>
        <b className="red-text">4</b> active exceptions
        <small>Last sync: {lastRefresh}</small>
      </section>

      {notice && (
        <div className="trips-notice" role="status">
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      <section className="trip-stats">
        <Stat label="ACTIVE TRIPS" value="18" suffix="units"
          description="Currently on route" color="blue" />
        <Stat label="DELIVERED STOPS" value="31" suffix="stops"
          description="Completed today" color="green" />
        <Stat label="IN PROGRESS" value="5" suffix="docks"
          description="Currently being served" color="blue" />
        <Stat label="LATE RISK" value="8" suffix="stops"
          description="Tight delivery windows" color="orange" />
        <Stat label="ISSUES" value="4" suffix="unresolved"
          description="Action required" color="red" />
        <Stat label="OFFLINE" value="1" suffix="unit"
          description="Last heard 06:12" color="gray" />
      </section>

      <section className="trip-toolbar">
        <div className="trip-filters">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`filter-chip ${
                activeFilter === filter ? "filter-active" : ""
              } filter-${filter.toLowerCase().replaceAll(" ", "-")}`}
            >
              {filter}
              {filter === "All" && " (18)"}
              {filter === "On Time" && " (10)"}
              {filter === "In Progress" && " (5)"}
              {filter === "Late Risk" && " (8)"}
              {filter === "Issues" && " (4)"}
              {filter === "Offline" && " (1)"}
            </button>
          ))}
        </div>

        <div className="trip-search-tools">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="⌕ Search vehicle, driver or order..."
            aria-label="Search trips"
          />
          <select
            value={depot}
            onChange={(event) => setDepot(event.target.value)}
            aria-label="Filter by depot"
          >
            <option>All Depots</option>
            <option>Colombo</option>
            <option>Jaffna</option>
          </select>
        </div>
      </section>

      <section className="trip-main-grid">
        <div className="panel map-panel">
          <PanelHeader
            title="LIVE OPERATIONS MAP"
            detail="18 Active Trips"
            extra="Corridor Health: Optimal (94%)"
          />
          <div className="colombo-map">
            <div className="map-water" />
            <svg
              className="map-drawing"
              viewBox="0 0 600 400"
              preserveAspectRatio="none"
              role="img"
              aria-label="Illustrative Colombo vehicle route map"
            >
              <path
                className="water-shape"
                d="M0 0 H93 L106 44 L187 48 L230 34 L298 53 L371 33 L455 46 L492 28 L600 43 V0 Z"
              />
              <path className="park-shape"
                d="M456 160 L512 148 L548 192 L504 210 L462 192 Z" />
              <path className="park-shape"
                d="M324 275 L361 269 L386 311 L342 329 L315 302 Z" />

              {Array.from({ length: 8 }).map((_, i) => (
                <path
                  key={`h${i}`}
                  className="map-road"
                  d={`M${100 + i * 7} ${80 + i * 38} L600 ${55 + i * 38}`}
                />
              ))}
              {Array.from({ length: 7 }).map((_, i) => (
                <path
                  key={`v${i}`}
                  className="map-road"
                  d={`M${100 + i * 68} 0 L${160 + i * 53} 400`}
                />
              ))}

              <path
                className="route-line"
                d="M188 145 L205 210 L315 209 L371 253 L390 324 L510 315 L480 245 L440 205 L365 193 L315 209"
              />
              <path
                className="route-warning"
                d="M315 209 L390 224 L480 245"
              />
              <path
                className="route-line"
                d="M188 145 L348 125 L436 125 L443 65"
              />

              {[
                [188, 145, "1"],
                [315, 209, "2"],
                [371, 253, "3"],
                [510, 315, "4"],
              ].map(([x, y, label]) => (
                <g key={label}>
                  <circle
                    cx={x}
                    cy={y}
                    r="11"
                    fill="#2160f5"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <text
                    x={x}
                    y={Number(y) + 4}
                    textAnchor="middle"
                    className="map-number"
                  >
                    {label}
                  </text>
                </g>
              ))}

              <circle cx="440" cy="205" r="11" fill="#e98100"
                stroke="white" strokeWidth="2" />
              <text x="440" y="209" textAnchor="middle"
                className="map-number">!</text>

              <circle cx="443" cy="65" r="12" fill="#111827"
                stroke="white" strokeWidth="2" />
              <text x="443" y="69" textAnchor="middle"
                className="map-number">DC</text>
            </svg>

            <div className="map-label label-river">Kelani River</div>
            <div className="map-label label-peliyagoda">Peliyagoda</div>
            <div className="map-label label-pettah">Pettah</div>
            <div className="map-label label-fort">Colombo Fort</div>
            <div className="map-label label-maradana">Maradana</div>
            <div className="map-label label-borella">Borella</div>
            <div className="map-label label-cinnamon">Cinnamon Gardens</div>
            <div className="map-label label-kollupitiya">Kollupitiya</div>
            <div className="map-label label-ocean">Indian Ocean</div>
            <div className="map-legend">Colombo · illustrative routes</div>
          </div>
        </div>

        <div className="panel active-trips-panel">
          <PanelHeader
            title="ACTIVE TRIPS"
            extra={`${filteredTrips.length} Shown`}
          />

          <div className="active-trip-list">
            {filteredTrips.length === 0 ? (
              <div className="empty-trips">
                No trips match your filters.
              </div>
            ) : (
              filteredTrips.map((trip) => (
                <button
                  key={trip.id}
                  className={`active-trip-card ${
                    selectedTrip === trip.id ? "trip-selected" : ""
                  }`}
                  onClick={() => setSelectedTrip(trip.id)}
                >
                  <div className="active-trip-top">
                    <strong>{trip.id}</strong>
                    <span>· {trip.route}</span>
                    <StatusBadge status={trip.status} />
                    <span className="trip-progress-count">
                      {trip.completed}/{trip.total} stops
                    </span>
                  </div>

                  <div className="stop-progress">
                    {Array.from({ length: trip.total }).map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < trip.completed
                            ? trip.status === "Issue" && i === 1
                              ? "progress-red"
                              : "progress-green"
                            : trip.status === "Late Risk"
                              ? "progress-orange"
                              : "progress-pending"
                        }
                      />
                    ))}
                  </div>

                  <div className="active-trip-bottom">
                    <span>Next: {trip.next}</span>
                    <strong>
                      {trip.eta === "Unknown"
                        ? "No signal"
                        : `ETA ${trip.eta}`}
                    </strong>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="selected-trip">
            <div className="selected-trip-heading">
              <div>
                <small>SELECTED TRIP</small>
                <h3>
                  {selected?.id ?? "VEH-018"} ·{" "}
                  {selected?.route ?? "Trip 1"}
                </h3>
              </div>
              <StatusBadge status={selected?.status ?? "On Schedule"} />
            </div>

            <p>
              {selected?.completed ?? 0} / {selected?.total ?? 0} stops
              {" · "}Next: {selected?.next ?? "—"}
            </p>

            {[
              ["Cargills – Colombo", "Delivered 08:12 AM", true],
              ["Food City – Galle", "Delivered 09:02 AM", true],
              [selected?.next ?? "Next stop", "In Progress", false],
              ["Lanka Pharmacy – Kandy", "Pending", false],
            ].map(([name, status, done]) => (
              <div className="stop-row" key={String(name)}>
                <span className={`stop-icon ${done ? "stop-done" : ""}`}>
                  {done ? "✓" : "•"}
                </span>
                <strong>{name}</strong>
                <span className={done ? "green-text" : ""}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel exceptions-panel">
        <div className="exceptions-heading">
          <h2><span className="exception-icon">♧</span> EXCEPTIONS · 4 ACTIVE</h2>
          <span className="urgent-badge">2 Require Immediate Action</span>
        </div>

        <div className="exception-list">
          {exceptions.map((exception) => (
            <div className="exception-row" key={exception.time}>
              <span className="exception-time">{exception.time}</span>
              <span className="exception-type">{exception.type}</span>
              <span className={`exception-severity severity-${exception.severity.toLowerCase().replaceAll(" ", "-")}`}>
                {exception.severity}
              </span>
              <strong className="exception-vehicle">{exception.vehicle}</strong>
              <span className="exception-description">
                {exception.description}
              </span>
              <button
                className="exception-open"
                onClick={() => setOpenException(exception)}
              >
                Open Exception
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="recovery-actions">
        <button className="trip-primary"
          onClick={() => setOpenException(exceptions[0])}>
          Review exceptions →
        </button>
        <button className="trip-button"
          onClick={() => showNotice("Revision history opened.")}>
          Revision history
        </button>
        <button className="trip-button"
          onClick={() => showNotice("All-clear summary prepared.")}>
          All-clear summary
        </button>
      </div>

      <section className="recovery-panel">
        <h2>Operational recovery</h2>
        <p>
          Review incidents and demonstrate recovery without losing
          dispatch context.
        </p>
        <button
          className="trip-button"
          onClick={() =>
            showNotice("Recovery scenarios are ready to configure.")
          }
        >
          Open recovery scenarios
        </button>
      </section>

      {openException && (
        <div
          className="trip-modal-backdrop"
          onClick={() => setOpenException(null)}
        >
          <section
            className="trip-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exception-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="trip-modal-close"
              onClick={() => setOpenException(null)}
              aria-label="Close dialog"
            >
              ×
            </button>
            <small>FIELD EXCEPTION · {openException.time}</small>
            <h2 id="exception-title">{openException.severity}</h2>
            <p><strong>{openException.vehicle}</strong></p>
            <p>{openException.description}</p>
            <p>Reported by: {openException.type}</p>
            <button
              className="trip-primary"
              onClick={() => {
                setNotice(
                  `Exception ${openException.vehicle} marked for review.`
                );
                setOpenException(null);
              }}
            >
              Mark for Review
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  suffix,
  description,
  color,
}: {
  label: string;
  value: string;
  suffix: string;
  description: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <div className={`stat-value ${color}`}>
        {value} <small>{suffix}</small>
      </div>
      <p>{description}</p>
    </div>
  );
}

function PanelHeader({
  title,
  detail,
  extra,
}: {
  title: string;
  detail?: string;
  extra?: string;
}) {
  return (
    <div className="panel-header">
      <h2><span className="panel-header-icon">▣</span> {title}</h2>
      {detail && <span className="panel-detail">{detail}</span>}
      {extra && <span className="panel-extra">{extra}</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: TripStatus }) {
  const classes: Record<TripStatus, string> = {
    "On Schedule": "status-on-time",
    "Late Risk": "status-late",
    Issue: "status-issue",
    Offline: "status-offline",
  };

  return <span className={`status-badge ${classes[status]}`}>{status}</span>;
}

