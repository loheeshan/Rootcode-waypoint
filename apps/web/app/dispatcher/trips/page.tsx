"use client";

import { useState } from "react";
import type {
  AuditEventResponse, OperationsExceptionKind, OperationsExceptionResponse, OperationsTripResponse, TripStatus, VehicleResponse,
} from "@waypoint/api-contracts";
import "./trips.css";
import { useDispatcher } from "../../../features/dispatcher/components/DispatcherShell";
import { Empty, Kv, LoadError, Loading, Pager, TripBadge, useLoad } from "../../../features/dispatcher/components/ui";
import {
  EXCEPTION_KINDS, EXCEPTION_LABEL, TRIP_STATUSES, TRIP_STATUS_LABEL, formatDate, formatDateTime, formatTime,
  getFleet, getLive, getPublication, getResults, listAudit, listExceptions, listOperationTrips, shortId, vehicleLabel,
} from "../../../features/dispatcher/data/dispatcher";

const PAGE = 20;

/** Live operations of the effective published plans: trips, loading, delivery, receipts and audit. */
export default function TripsPage() {
  const { depotId, day, onExpired } = useDispatcher();
  const scope = { depot_id: depotId, delivery_date: day };
  const key = `${depotId}:${day}`;
  const [status, setStatus] = useState<TripStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(() => new Date().toISOString());

  const live = useLoad(() => getLive(scope), onExpired, `${key}:${lastRefresh}`);
  const trips = useLoad(() => listOperationTrips({ ...scope, status: status === "ALL" ? undefined : status, limit: PAGE, offset: page * PAGE }), onExpired, `${key}:${status}:${page}:${lastRefresh}`);
  const fleet = useLoad(() => getFleet(depotId), onExpired, depotId);
  const vehicles = new Map((fleet.data?.items ?? []).map((v) => [v.id, v]));

  const s = live.data;
  const tripTotal = s ? TRIP_STATUSES.reduce((n, t) => n + s.trips_by_status[t], 0) : 0;
  const exceptionTotal = s ? EXCEPTION_KINDS.reduce((n, k) => n + s.exceptions[k], 0) : 0;
  const selected = trips.data?.items.find((t) => t.trip.trip_id === selectedId) ?? trips.data?.items[0] ?? null;

  return (
    <main className="trips-page">
      <header className="trips-heading">
        <div>
          <div className="trips-breadcrumb">OPERATIONS <span>/</span> <b>Trips</b></div>
          <h1>Live Operations <span className="dispatch-badge">PUBLISHED PLANS</span></h1>
          <p>Trips of each plan&apos;s effective published revision for {formatDate(day)}. Read-only: the API has no override actions.</p>
        </div>
        <div className="trips-actions">
          <button className="trip-button" onClick={() => setLastRefresh(new Date().toISOString())}>↻ Refresh</button>
        </div>
      </header>

      {live.loading && !s ? <Loading t="Loading operations…" /> : live.error ? <LoadError error={live.error} retry={live.reload} /> : s && (
        <>
          <section className="live-strip">
            <span className="live-dot" />
            <strong>SERVER SNAPSHOT</strong>
            <span>·</span> <b>{tripTotal}</b> trips
            <span>·</span> <b className="green-text">{s.delivery.delivered_stops}</b> stops delivered
            <span>·</span> <b className="red-text">{exceptionTotal}</b> exceptions
            <small>Loaded {formatTime(lastRefresh)} (Colombo)</small>
          </section>

          <section className="trip-stats">
            <Stat label="PLANS" value={`${s.published_plans}`} suffix="published" description={`${s.draft_plans} draft (not visible to Loaders/Drivers)`} color="blue" />
            <Stat label="IN PROGRESS" value={`${s.trips_by_status.IN_PROGRESS}`} suffix="trips" description={`${s.trips_by_status.READY} ready · ${s.trips_by_status.COMPLETED} completed`} color="blue" />
            <Stat label="LOADING" value={`${s.loading.loaded}/${s.loading.orders}`} suffix="loaded" description={`${s.loading.pending} pending · ${s.loading.missing} missing · ${s.loading.damaged} damaged`} color="green" />
            <Stat label="DELIVERY" value={`${s.delivery.delivered_stops}/${s.delivery.stops_requiring_visit}`} suffix="stops" description={`${s.delivery.failed_stops} failed · ${s.delivery.open_stops} open · ${s.delivery.delivered_orders} orders delivered`} color="green" />
            <Stat label="STORE RECEIPTS" value={`${s.delivery.receipts_confirmed}`} suffix="confirmed" description={`${s.receipts_pending} orders awaiting receipt`} color="orange" />
            <Stat label="DEFERRED" value={`${s.deferred_orders}`} suffix="orders" description="Not served by the published plans" color="gray" />
          </section>

          <section className="trip-toolbar">
            <div className="trip-filters">
              {(["ALL", ...TRIP_STATUSES] as const).map((t) => (
                <button key={t} onClick={() => { setStatus(t); setPage(0); }} className={`filter-chip ${status === t ? "filter-active" : ""}`}>
                  {t === "ALL" ? `All (${tripTotal})` : `${TRIP_STATUS_LABEL[t]} (${s.trips_by_status[t]})`}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="trip-main-grid">
        <div className="panel active-trips-panel">
          <div className="panel-header"><h2><span className="panel-header-icon">▣</span> TRIPS</h2><span className="panel-extra">{trips.data?.total ?? 0} total</span></div>
          {trips.loading ? <Loading t="Loading trips…" /> : trips.error ? <LoadError error={trips.error} retry={trips.reload} /> : !trips.data?.items.length ? (
            <div className="empty-trips">No published trips for this depot, date and status.</div>
          ) : (
            <div className="active-trip-list">
              {trips.data.items.map((item) => (
                <TripCard key={item.trip.trip_id} item={item} vehicle={vehicles.get(item.trip.vehicle_id)} selected={selected?.trip.trip_id === item.trip.trip_id} onSelect={() => setSelectedId(item.trip.trip_id)} />
              ))}
            </div>
          )}
          <Pager total={trips.data?.total ?? 0} page={page} size={PAGE} busy={trips.loading} onPage={setPage} />
        </div>

        <div className="panel">
          {selected ? <TripDetail key={selected.trip.trip_id} item={selected} vehicle={vehicles.get(selected.trip.vehicle_id)} onExpired={onExpired} />
            : <Empty t="No trip selected" d="Published trips appear here once a plan is published." />}
        </div>
      </section>

      <Exceptions key={`${key}:${lastRefresh}`} scope={scope} onExpired={onExpired} />
      <AuditLog key={`audit:${key}:${lastRefresh}`} depotId={depotId} tripId={selected?.trip.trip_id ?? null} onExpired={onExpired} />
    </main>
  );
}

function TripCard({ item, vehicle, selected, onSelect }: { item: OperationsTripResponse; vehicle?: VehicleResponse; selected: boolean; onSelect: () => void }) {
  const { trip, delivery } = item;
  const done = delivery.delivered_stops + delivery.failed_stops;
  return (
    <button className={`active-trip-card ${selected ? "trip-selected" : ""}`} onClick={onSelect}>
      <div className="active-trip-top">
        <strong>{vehicle ? vehicleLabel(vehicle) : shortId(trip.vehicle_id)}</strong>
        <span>· Trip {trip.trip_number}</span>
        <TripBadge status={trip.status} />
        <span className="trip-progress-count">{done}/{delivery.stops_requiring_visit} stops</span>
      </div>
      <div className="stop-progress">
        {Array.from({ length: delivery.stops_requiring_visit }).map((_, i) => (
          <span key={i} className={i < delivery.delivered_stops ? "progress-green" : i < done ? "progress-red" : "progress-pending"} />
        ))}
      </div>
      <div className="active-trip-bottom">
        <span>Driver {trip.driver_id ? shortId(trip.driver_id) : "unassigned"}</span>
        <strong>{formatTime(trip.departure_at)}–{formatTime(trip.return_at)}</strong>
      </div>
    </button>
  );
}

function TripDetail({ item, vehicle, onExpired }: { item: OperationsTripResponse; vehicle?: VehicleResponse; onExpired: () => void }) {
  const { trip, loading, delivery } = item;
  // Stop sequence comes from the saved result of the plan's effective published revision.
  const stops = useLoad(async () => {
    const publication = await getPublication(trip.plan_id);
    if (!publication) return null;
    const result = await getResults(trip.plan_id, publication.revision_id);
    return result?.trips.find((t) => t.id === trip.trip_id)?.stops ?? null;
  }, onExpired, trip.trip_id);

  return (
    <div className="selected-trip">
      <div className="selected-trip-heading">
        <div>
          <small>SELECTED TRIP</small>
          <h3>{vehicle ? vehicleLabel(vehicle) : shortId(trip.vehicle_id)} · Trip {trip.trip_number}</h3>
        </div>
        <TripBadge status={trip.status} />
      </div>
      <Kv a="Driver" b={trip.driver_id ? <span title={trip.driver_id}>{shortId(trip.driver_id)}</span> : "Unassigned"} />
      <Kv a="Planned" b={`${formatTime(trip.departure_at)}–${formatTime(trip.return_at)}`} />
      <Kv a="Stops / orders" b={`${trip.stop_count} / ${trip.order_count}`} />
      <Kv a="Loading" b={`${loading.loaded} loaded · ${loading.missing} missing · ${loading.damaged} damaged · ${loading.pending} pending`} />
      <Kv a="Delivery" b={`${delivery.delivered_stops} delivered · ${delivery.failed_stops} failed · ${delivery.open_stops} open of ${delivery.stops_requiring_visit}`} />
      <Kv a="Store receipts" b={`${delivery.receipts_confirmed} of ${delivery.delivered_orders} delivered orders`} />
      <p className="dx-muted">Per-stop outcomes appear under exceptions and in the audit log; the API has no Dispatcher stop view.</p>
      {stops.loading ? <Loading t="Loading stop sequence…" /> : stops.error ? <LoadError error={stops.error} retry={stops.reload} /> : stops.data ? stops.data.map((stop) => (
        <div className="stop-row" key={stop.id}>
          <span className="stop-icon">{stop.sequence_number}</span>
          <strong title={stop.outlet_id}>Outlet {shortId(stop.outlet_id)} · {stop.order_ids.length} order{stop.order_ids.length === 1 ? "" : "s"}</strong>
          <span>Planned arrival {formatTime(stop.arrival_at)}</span>
        </div>
      )) : <p className="dx-muted">Stop sequence unavailable.</p>}
    </div>
  );
}

function Exceptions({ scope, onExpired }: { scope: { depot_id: string; delivery_date: string }; onExpired: () => void }) {
  const [kind, setKind] = useState<OperationsExceptionKind | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<OperationsExceptionResponse | null>(null);
  const list = useLoad(() => listExceptions({ ...scope, kind: kind === "ALL" ? undefined : kind, limit: PAGE, offset: page * PAGE }), onExpired, `${kind}:${page}`);

  return (
    <section className="panel exceptions-panel">
      <div className="exceptions-heading">
        <h2><span className="exception-icon">♧</span> EXCEPTIONS · {list.data?.total ?? 0}</h2>
      </div>
      <div className="trip-filters">
        {(["ALL", ...EXCEPTION_KINDS] as const).map((k) => (
          <button key={k} className={`filter-chip ${kind === k ? "filter-active" : ""}`} onClick={() => { setKind(k); setPage(0); }}>
            {k === "ALL" ? "All" : EXCEPTION_LABEL[k]}
          </button>
        ))}
      </div>
      {list.loading ? <Loading /> : list.error ? <LoadError error={list.error} retry={list.reload} /> : !list.data?.items.length ? (
        <div className="empty-trips">No exceptions for this depot and date.</div>
      ) : (
        <div className="exception-list">
          {list.data.items.map((e) => (
            <div className="exception-row" key={`${e.kind}:${e.source_id}`}>
              <span className="exception-time">{formatTime(e.occurred_at)}</span>
              <span className="exception-type">{e.severity === "PENDING" ? "PENDING" : "FAILURE"}</span>
              <span className="exception-severity">{EXCEPTION_LABEL[e.kind]}</span>
              <strong className="exception-vehicle">Trip {shortId(e.trip_id)}{e.outlet_id ? ` · outlet ${shortId(e.outlet_id)}` : ""}</strong>
              <span className="exception-description">{[e.reason_code, e.note].filter(Boolean).join(" · ") || `${e.order_ids.length} order(s)`}</span>
              <button className="exception-open" onClick={() => setOpen(e)}>Details</button>
            </div>
          ))}
        </div>
      )}
      <Pager total={list.data?.total ?? 0} page={page} size={PAGE} busy={list.loading} onPage={setPage} />

      {open && (
        <div className="trip-modal-backdrop" onClick={() => setOpen(null)}>
          <section className="trip-modal" role="dialog" aria-modal="true" aria-labelledby="exception-title" onClick={(event) => event.stopPropagation()}>
            <button className="trip-modal-close" onClick={() => setOpen(null)} aria-label="Close dialog">×</button>
            <small>{open.severity} · {formatDateTime(open.occurred_at)}</small>
            <h2 id="exception-title">{EXCEPTION_LABEL[open.kind]}</h2>
            <Kv a="Trip" b={<span title={open.trip_id}>{shortId(open.trip_id)}</span>} />
            {open.stop_id && <Kv a="Stop" b={shortId(open.stop_id)} />}
            {open.outlet_id && <Kv a="Outlet" b={shortId(open.outlet_id)} />}
            <Kv a="Orders" b={open.order_ids.map(shortId).join(", ") || "—"} />
            <Kv a="Reason" b={open.reason_code ?? "—"} />
            <Kv a="Note" b={open.note ?? "—"} />
            <Kv a="Recorded by" b={open.actor_id ? shortId(open.actor_id) : "—"} />
            <p className="dx-muted">Read-only: resolving or re-planning exceptions is not available in the API.</p>
          </section>
        </div>
      )}
    </section>
  );
}

function AuditLog({ depotId, tripId, onExpired }: { depotId: string; tripId: string | null; onExpired: () => void }) {
  const [onlyTrip, setOnlyTrip] = useState(false);
  const [page, setPage] = useState(0);
  const filterTrip = onlyTrip && tripId ? tripId : undefined;
  const list = useLoad(() => listAudit({ depot_id: depotId, trip_id: filterTrip, limit: PAGE, offset: page * PAGE }), onExpired, `${filterTrip}:${page}`);

  return (
    <section className="panel exceptions-panel" id="audit">
      <div className="exceptions-heading">
        <h2><span className="exception-icon">▤</span> AUDIT LOG · {list.data?.total ?? 0}</h2>
        {tripId && (
          <label className="dx-muted"><input type="checkbox" checked={onlyTrip} onChange={(e) => { setOnlyTrip(e.target.checked); setPage(0); }} /> Selected trip only</label>
        )}
      </div>
      {list.loading ? <Loading /> : list.error ? <LoadError error={list.error} retry={list.reload} /> : !list.data?.items.length ? (
        <div className="empty-trips">No audit entries yet. Publishing, loading, delivery and receipts are recorded here.</div>
      ) : (
        <div className="dx-table-wrap">
          <table className="dx-table">
            <thead><tr><th>TIME (COLOMBO)</th><th>ACTION</th><th>ENTITY</th><th>TRIP</th><th>ACTOR</th><th>DETAILS</th></tr></thead>
            <tbody>
              {list.data.items.map((a: AuditEventResponse) => (
                <tr key={a.id}>
                  <td>{formatDateTime(a.occurred_at)}</td>
                  <td><span className="dx-badge">{a.action}</span></td>
                  <td>{a.entity_type} {shortId(a.entity_id)}</td>
                  <td>{a.trip_id ? shortId(a.trip_id) : "—"}</td>
                  <td title={a.actor_id}>{shortId(a.actor_id)}</td>
                  <td><code style={{ fontSize: 11, wordBreak: "break-all" }}>{JSON.stringify(a.details)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager total={list.data?.total ?? 0} page={page} size={PAGE} busy={list.loading} onPage={setPage} />
    </section>
  );
}

function Stat({ label, value, suffix, description, color }: { label: string; value: string; suffix: string; description: string; color: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <div className={`stat-value ${color}`}>{value} <small>{suffix}</small></div>
      <p>{description}</p>
    </div>
  );
}
