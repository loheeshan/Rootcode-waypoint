'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  type DispatcherOrderResponse,
  type OptimizationResponse,
  type PlanDetailResponse,
  type PublicationResponse,
  type VehicleResponse,
} from '@waypoint/api-contracts';
import { useDispatcher } from '../../../features/dispatcher/components/DispatcherShell';
import { Alert, Empty, Kv, LoadError, Loading, OrderBadge, useLoad } from '../../../features/dispatcher/components/ui';
import {
  COMPATIBILITY_LABEL, DEFERRAL_LABEL, PLANNING_RULES, SYNTHETIC_SOURCE, SYNTHETIC_TRAVEL, UUID_PATTERN,
  allOrdersForDay, buildOptimizeRequest, colomboToday, createRequestKeeper, exceeds, failureMessage, formatDate,
  defaultShiftStart, formatDateTime, formatTime, getCompatibility, getFleet, getPlan, getPublication, getResults, isUncertain, listPlans,
  openPlan, optimizePlan, publishRevision, readDaily, requiredFuelDays, shortId, sumDecimals, temperatureLabel,
  validateShift, vehicleLabel, windowLabel, type ShiftDraft,
} from '../../../features/dispatcher/data/dispatcher';

type Notice = { k: 'i' | 'w' | 'e' | 's'; t: string; d?: string } | null;

/** Plan workspace for the selected depot and Colombo date: inputs, optimization, results, publishing. */
export default function PlanningPage() {
  const { depotId, depots, day, onExpired } = useDispatcher();
  const today = colomboToday();
  const key = `${depotId}:${day}`;
  // Find without creating: opening the page never writes; creating is an explicit action.
  const found = useLoad(async () => {
    const item = (await listPlans({ depot_id: depotId, delivery_date: day, limit: 1 })).items[0];
    return item ? getPlan(item.id) : null;
  }, onExpired, key);
  const [plan, setPlan] = useState<PlanDetailResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  useEffect(() => { setPlan(found.data ?? null); setCreateError(null); }, [found.data]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      setPlan((await openPlan(depotId, day)).plan);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return onExpired();
      setCreateError(failureMessage(error, 'The plan'));
    } finally {
      setCreating(false);
    }
  };

  const depotName = depots.find((d) => d.id === depotId)?.name ?? '';
  return (
    <div className="planning-page">
      <div className="planning-header">
        <div>
          <div className="planning-title-row">
            <h1>Planning Workspace</h1>
            {plan && <span className="desk-badge">{plan.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>}
          </div>
          <p>{depotName} · {formatDate(day)}. Change the depot or date in the top bar.</p>
        </div>
      </div>

      <section className="card">
        <h2>Planning rules enforced by the server</h2>
        <ul className="dx-rules">{PLANNING_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      </section>

      {found.loading ? <Loading t="Loading plan…" /> : found.error ? <LoadError error={found.error} retry={found.reload} /> : !plan ? (
        <section className="card">
          <Empty t="No plan for this depot and date" d={day < today ? 'Plans cannot be created for past dates.' : 'Create the workspace to load eligible orders and vehicles. One plan exists per depot and date.'}>
            {createError && <Alert k="e" t="Plan not created">{createError}</Alert>}
            {day >= today && <button className="dx-btn p" disabled={creating} onClick={create}>{creating ? 'Creating…' : 'Create plan workspace'}</button>}
          </Empty>
        </section>
      ) : (
        <Workspace key={plan.id} initial={plan} today={today} onExpired={onExpired} />
      )}
    </div>
  );
}

function Workspace({ initial, today, onExpired }: { initial: PlanDetailResponse; today: string; onExpired: () => void }) {
  const [plan, setPlan] = useState(initial);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  // Bumped after a publish attempt so the live input panel re-reads orders and vehicles too.
  const [version, setVersion] = useState(0);
  const day = plan.delivery_date;

  const fleet = useLoad(() => getFleet(plan.depot_id), onExpired, plan.depot_id);
  const orders = useLoad(() => allOrdersForDay(plan.depot_id, day), onExpired, plan.id);
  const publication = useLoad(() => getPublication(plan.id), onExpired, plan.id);

  const vehicles = useMemo(() => new Map((fleet.data?.items ?? []).map((v) => [v.id, v])), [fleet.data]);
  const orderMap = useMemo(() => new Map((orders.data ?? []).map((o) => [o.id, o])), [orders.data]);

  const reloadAll = async () => {
    try {
      setPlan(await getPlan(plan.id));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return onExpired();
    }
    orders.reload();
    publication.reload();
  };

  const published = publication.data ?? null;
  // Revision 1 is the empty workspace; optimizations always add later revisions.
  const optimized = plan.revisions.filter((r) => r.revision_number > 1);
  const shownRevision = revisionId ?? published?.revision_id ?? optimized[optimized.length - 1]?.id ?? null;
  const editable = plan.status === 'DRAFT' && !published && day >= today;

  return (
    <>
      {notice && <Alert k={notice.k} t={notice.t}>{notice.d}</Alert>}
      <section className="card">
        <div className="card-header">
          <h2>Revisions</h2>
          <button onClick={reloadAll}>↻ Reload</button>
        </div>
        <div className="dx-table-wrap">
          <table className="dx-table">
            <thead><tr><th>REVISION</th><th>STATUS</th><th>TRIPS</th><th>SERVED</th><th>DEFERRED</th><th>UNEXPLAINED</th><th /></tr></thead>
            <tbody>
              {plan.revisions.map((r) => (
                <tr key={r.id}>
                  <td>#{r.revision_number}{r.id === published?.revision_id && <> <span className="dx-badge green">Effective published</span></>}</td>
                  <td>{r.status === 'PUBLISHED' ? <span className="dx-badge green">Published {r.published_at ? formatDateTime(r.published_at) : ''}</span> : <span className="dx-badge">Draft</span>}</td>
                  <td>{r.trip_count}</td><td>{r.served_order_count}</td><td>{r.deferred_order_count}</td>
                  <td>{r.unexplained_deferred_count ? <span className="dx-badge red">{r.unexplained_deferred_count}</span> : 0}</td>
                  <td><button className={`dx-btn ${shownRevision === r.id ? 'on' : ''}`} onClick={() => setRevisionId(r.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dx-muted">Revision counts are stored totals, not a feasibility check. Only a publication makes a revision effective.</p>
      </section>

      {published && <PublicationCard publication={published} vehicles={vehicles} />}
      {publication.error && <LoadError error={publication.error} retry={publication.reload} />}

      {editable && (
        <Inputs
          key={version}
          plan={plan}
          today={today}
          onExpired={onExpired}
          onOptimized={async (result) => {
            setNotice({ k: 's', t: `Revision ${result.revision_number} saved`, d: `${result.trips.length} trips, ${result.deferrals.length} deferred orders. It is a validated draft snapshot, not a published plan.` });
            setRevisionId(result.revision_id);
            await reloadAll();
          }}
        />
      )}

      {shownRevision ? (
        <Results
          key={shownRevision}
          plan={plan}
          revisionId={shownRevision}
          published={published}
          canPublish={editable}
          vehicles={vehicles}
          orderMap={orderMap}
          onExpired={onExpired}
          onPublishSettled={async (message) => { setNotice(message); await reloadAll(); setVersion((v) => v + 1); }}
        />
      ) : (
        <section className="card"><Empty t="No optimized revision yet" d={editable ? 'Prepare the inputs above and run the optimizer.' : 'This plan has no saved optimization result.'} /></section>
      )}
    </>
  );
}

/* ---------- inputs and optimization ---------- */

function Inputs({ plan, today, onExpired, onOptimized }: {
  plan: PlanDetailResponse; today: string; onExpired: () => void; onOptimized: (result: OptimizationResponse) => Promise<void>;
}) {
  const day = plan.delivery_date;
  const [page, setPage] = useState(0);
  const compat = useLoad(() => getCompatibility(plan.id, 100, page * 100), onExpired, `${plan.id}:${page}`);
  const available = (compat.data?.vehicles ?? []).filter((v) => v.is_available === true).map((v) => v.vehicle);
  const unknown = (compat.data?.vehicles ?? []).filter((v) => v.is_available === null);
  const fuelDays = requiredFuelDays(day, today);
  const fuelCheck = useLoad(async () => {
    const missing: string[] = [];
    for (const vehicle of available) {
      for (const d of fuelDays) if (!(await readDaily('fuel-usage', vehicle.id, d))) missing.push(`${vehicleLabel(vehicle)} on ${formatDate(d)}`);
    }
    return missing;
  }, onExpired, `${plan.id}:${available.map((v) => v.id).join()}:${fuelDays.join()}`);

  const [shifts, setShifts] = useState<Record<string, ShiftDraft>>({});
  const [defaultStart] = useState(() => defaultShiftStart(day));
  const [serviceMinutes, setServiceMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ t: string; uncertain: boolean } | null>(null);
  const keeper = useRef(createRequestKeeper());
  const sending = useRef(false);

  const shiftFor = (vehicleId: string): ShiftDraft => shifts[vehicleId] ?? { vehicle_id: vehicleId, start: defaultStart, end: '18:00', turnaroundMinutes: 15 };
  const update = (vehicleId: string, patch: Partial<ShiftDraft>) => setShifts((s) => ({ ...s, [vehicleId]: { ...shiftFor(vehicleId), ...patch } }));
  // With no eligible orders the server expects no shifts and needs no availability or fuel.
  const hasOrders = (compat.data?.total ?? 0) > 0;
  const planned = hasOrders ? available : [];
  const shiftErrors = planned.map((v) => validateShift(shiftFor(v.id))).filter(Boolean);
  // Every eligible outlet needs a service entry, so all order pages must be loaded.
  const outletIds = (compat.data?.items ?? []).map((item) => item.order.outlet_id);
  const allPagesLoaded = !!compat.data && compat.data.total <= 100;
  const serviceValid = Number.isInteger(serviceMinutes) && serviceMinutes >= 0 && serviceMinutes <= 600;
  const inputsKnown = !hasOrders || (!unknown.length && !fuelCheck.loading && !fuelCheck.error && !fuelCheck.data?.length);
  const ready = !!compat.data && allPagesLoaded && inputsKnown && !shiftErrors.length && serviceValid;

  const run = async () => {
    if (sending.current || !compat.data) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const base = { day, outletIds, shifts: planned.map((v) => shiftFor(v.id)), serviceMinutes };
    // Same inputs after an uncertain failure reuse the request ID, so the server can only replay.
    const requestId = keeper.current.idFor(base);
    try {
      const response = await optimizePlan(plan.id, buildOptimizeRequest({ ...base, requestId }));
      keeper.current.settle();
      await onOptimized(response.data);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return onExpired();
      if (failure instanceof ApiError && failure.status === 409) keeper.current.settle();
      setError({ t: failureMessage(failure, 'The optimization'), uncertain: isUncertain(failure) });
      compat.reload();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="dx-grid2">
      <section className="card">
        <div className="card-header"><h2>Eligible orders ({compat.data?.total ?? '…'})</h2><button onClick={compat.reload}>↻ Refresh</button></div>
        <Alert t="The server plans every confirmed order for this depot and date">
          Orders cannot be excluded individually; each one is either served on a trip or deferred with a reason.
          This compatibility preview checks each order alone and is not a complete validation.
        </Alert>
        {compat.loading ? <Loading t="Loading orders and vehicles…" /> : compat.error ? <LoadError error={compat.error} retry={compat.reload} /> : !compat.data?.items.length ? (
          <Empty t="No confirmed orders for this date" d="Optimizing an empty day saves an empty revision." />
        ) : (
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead><tr><th>ORDER</th><th>OUTLET</th><th>LOAD</th><th>WINDOW</th><th>VEHICLES</th></tr></thead>
              <tbody>
                {compat.data.items.map(({ order, candidate_vehicle_ids, excluded_vehicles }) => (
                  <tr key={order.id}>
                    <td title={order.id}><strong>{shortId(order.id)}</strong><div><OrderBadge status={order.status} /></div></td>
                    <td>{order.outlet.brand}<div className="dx-muted">{order.outlet.district}{order.outlet.parking_constraint === 'van_only' && ' · van only'}</div></td>
                    <td>{temperatureLabel(order.temperature_requirement)}<div className="dx-muted">{order.order_weight_kg} kg · {order.order_volume_m3} m³</div></td>
                    <td>{windowLabel(order.outlet.window_open_time, order.outlet.window_close_time)}</td>
                    <td>
                      {candidate_vehicle_ids.length ? <span className="dx-badge green">{candidate_vehicle_ids.length} candidate</span> : <span className="dx-badge red">No candidate</span>}
                      {excluded_vehicles.map((ex) => (
                        <div key={ex.vehicle_id} className="dx-muted">{shortId(ex.vehicle_id)}: {ex.reasons.map((r) => COMPATIBILITY_LABEL[r]).join(', ')}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compat.data.total > 100 && (
              <div className="dx-row">
                <button className="dx-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Previous</button>
                <button className="dx-btn" disabled={(page + 1) * 100 >= compat.data.total} onClick={() => setPage(page + 1)}>Next ›</button>
                <span className="dx-muted">More than 100 eligible orders exceeds the optimizer limit.</span>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Vehicles, shifts and optimization</h2>
        {compat.data && (
          <>
            {compat.data.vehicles.map(({ vehicle, is_available }) => (
              <div key={vehicle.id} className="fleet-row">
                <span className="fleet-icon">{vehicle.temperature_type === 'reefer' ? '✣' : '▱'}</span>
                <div>
                  <strong>{vehicleLabel(vehicle)}</strong>
                  <p>Cap: {vehicle.weight_cap_kg} kg · {vehicle.volume_cap_m3} m³ · quota {vehicle.weekly_fuel_quota_l} L/week</p>
                  {is_available && (
                    <div className="dx-row">
                      <label className="dx-field">Earliest departure<input type="time" value={shiftFor(vehicle.id).start} onChange={(e) => update(vehicle.id, { start: e.target.value })} /></label>
                      <label className="dx-field">Latest return<input type="time" value={shiftFor(vehicle.id).end} onChange={(e) => update(vehicle.id, { end: e.target.value })} /></label>
                      <label className="dx-field">Turnaround (min)<input type="number" min={0} max={600} value={shiftFor(vehicle.id).turnaroundMinutes} onChange={(e) => update(vehicle.id, { turnaroundMinutes: Number(e.target.value) })} /></label>
                    </div>
                  )}
                  {is_available && validateShift(shiftFor(vehicle.id)) && <div className="dx-muted" role="alert">{validateShift(shiftFor(vehicle.id))}</div>}
                </div>
                <span className={`fleet-status ${is_available ? 'available' : 'standby'}`}>
                  {is_available === true ? 'Available' : is_available === false ? 'Unavailable' : 'Not recorded'}
                </span>
              </div>
            ))}
            {!compat.data.vehicles.length && <p className="dx-muted">This depot has no vehicles.</p>}
            {unknown.length > 0 && <Alert k="w" t="Record availability for every vehicle">Availability is unknown for {unknown.map((v) => vehicleLabel(v.vehicle)).join(', ')}. <Link href="/dispatcher/fleet">Open fleet inputs</Link>.</Alert>}
            <p className="dx-muted">Vehicles are chosen by availability for {formatDate(day)}; change it in <Link href="/dispatcher/fleet">fleet inputs</Link>. Shift times are Colombo time on the plan date.</p>
          </>
        )}

        {fuelCheck.loading ? <Loading t="Checking fuel records…" /> : fuelCheck.error ? <LoadError error={fuelCheck.error} retry={fuelCheck.reload} />
          : fuelCheck.data?.length ? <Alert k="w" t="Fuel totals missing">{fuelCheck.data.join('; ')}. Record them in <Link href="/dispatcher/fleet">fleet inputs</Link>.</Alert>
            : available.length ? <p className="dx-muted">Fuel totals recorded for every required day{fuelDays.length ? '' : ' (none needed: the plan week has not started)'}.</p> : null}

        <label className="dx-field" style={{ maxWidth: 220 }}>Service time per outlet (min, synthetic)
          <input type="number" min={0} max={600} value={serviceMinutes} onChange={(e) => setServiceMinutes(Number(e.target.value))} />
        </label>
        <Alert k="w" t="Synthetic travel data">
          {SYNTHETIC_SOURCE}: {SYNTHETIC_TRAVEL.depotKm} km / {SYNTHETIC_TRAVEL.depotSeconds / 60} min for depot legs,
          {' '}{SYNTHETIC_TRAVEL.outletKm} km / {SYNTHETIC_TRAVEL.outletSeconds / 60} min between outlets. No road data source exists yet;
          the request is marked synthetic and results show it.
        </Alert>
        {error && <Alert k="e" t="Optimization not saved">{error.t}{error.uncertain && ' Run again without changing inputs to retry the same request.'}</Alert>}
        <button className="primary-button" disabled={!ready || busy} onClick={run}>{busy ? 'Optimizing… (up to ~20 s)' : '⚡ Run optimization'}</button>
      </section>
    </div>
  );
}

/* ---------- saved results, driver assignment and publishing ---------- */

function Results({ plan, revisionId, published, canPublish, vehicles, orderMap, onExpired, onPublishSettled }: {
  plan: PlanDetailResponse; revisionId: string; published: PublicationResponse | null; canPublish: boolean;
  vehicles: Map<string, VehicleResponse>; orderMap: Map<string, DispatcherOrderResponse>;
  onExpired: () => void; onPublishSettled: (notice: Notice) => Promise<void>;
}) {
  const result = useLoad(() => getResults(plan.id, revisionId), onExpired, revisionId);
  const [drivers, setDrivers] = useState<Record<string, string>>({});
  const [allDriver, setAllDriver] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ t: string; uncertain: boolean } | null>(null);
  const keeper = useRef(createRequestKeeper());
  const sending = useRef(false);

  if (result.loading) return <section className="card"><Loading t="Loading saved results…" /></section>;
  if (result.error) return <section className="card"><LoadError error={result.error} retry={result.reload} /></section>;
  const saved = result.data;
  if (!saved) return <section className="card"><Empty t="This revision has no optimization result" d="Revision 1 is the empty workspace; run the optimizer to create a result." /></section>;

  const isPublished = published?.revision_id === saved.revision_id;
  const publishedDriver = new Map((isPublished ? published.trips : []).map((t) => [t.trip_id, t.driver_id]));
  const assignments = saved.trips.map((t) => ({ trip_id: t.id, driver_id: (drivers[t.id] ?? '').trim() }));
  const invalid = assignments.some((a) => !UUID_PATTERN.test(a.driver_id));

  const publish = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const requestId = keeper.current.idFor({ revision: saved.revision_id, assignments });
    try {
      const response = await publishRevision(plan.id, saved.revision_id, { request_id: requestId, driver_assignments: assignments });
      keeper.current.settle();
      await onPublishSettled({ k: 's', t: `Revision ${response.data.revision_number} published`, d: `Revalidated against current inputs: ${response.data.served_order_count} served, ${response.data.deferred_order_count} deferred.` });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return onExpired();
      const uncertain = isUncertain(failure);
      if (!uncertain) keeper.current.settle();
      setError({ t: failureMessage(failure, 'The publication'), uncertain });
      // Conflicts (stale inputs, already published, departure passed): reload the server state.
      if (failure instanceof ApiError && failure.status === 409) await onPublishSettled(null);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const served = saved.trips.reduce((n, t) => n + t.stops.reduce((m, s) => m + s.order_ids.length, 0), 0);
  return (
    <>
      <section className="card">
        <div className="dx-row sp">
          <h2>Revision {saved.revision_number} result</h2>
          <div className="dx-row">
            {isPublished ? <span className="dx-badge green">Published · revalidated at publish</span>
              : <span className="dx-badge orange">Validated draft snapshot · not published</span>}
            {saved.is_synthetic && <span className="dx-badge orange">Synthetic travel data</span>}
          </div>
        </div>
        <Kv a="Eligible orders" b={saved.eligible_order_count} />
        <Kv a="Served / deferred" b={`${served} / ${saved.deferrals.length}`} />
        <Kv a="Travel source" b={saved.source} />
        <Kv a="Saved" b={formatDateTime(saved.created_at)} />
        <p className="dx-muted">Saved result from the optimizer ({saved.algorithm}); it is not re-run and does not reflect later input changes.</p>
      </section>

      <div className="dx-grid2">
        {saved.trips.map((trip) => {
          const vehicle = vehicles.get(trip.vehicle_id);
          const tripOrders = trip.stops.flatMap((s) => s.order_ids.map((id) => orderMap.get(id)));
          const known = tripOrders.every(Boolean);
          const weight = known ? sumDecimals(tripOrders.map((o) => o!.order_weight_kg)) : null;
          const volume = known ? sumDecimals(tripOrders.map((o) => o!.order_volume_m3)) : null;
          return (
            <section className="vehicle-panel planning-panel" key={trip.id}>
              <div className="vehicle-header">
                <div className="vehicle-title">
                  <span className="truck-icon">{vehicle?.temperature_type === 'reefer' ? '✣' : '▱'}</span>
                  <div>
                    <h2>{vehicle ? vehicleLabel(vehicle) : shortId(trip.vehicle_id)} · Trip {trip.trip_number}</h2>
                    <p>{formatTime(trip.departure_at)}–{formatTime(trip.return_at)} · {trip.distance_km} km · {trip.fuel_l} L</p>
                  </div>
                </div>
              </div>
              <div className="capacity-row">
                <div><span>Weight: {weight ?? '—'} / {vehicle?.weight_cap_kg ?? '—'} kg</span>{weight && vehicle && exceeds(weight, vehicle.weight_cap_kg) && <strong>Over capacity</strong>}</div>
                <div><span>Volume: {volume ?? '—'} / {vehicle?.volume_cap_m3 ?? '—'} m³</span>{volume && vehicle && exceeds(volume, vehicle.volume_cap_m3) && <strong>Over capacity</strong>}</div>
              </div>
              <div className="stops-header"><strong>STOP SEQUENCE ({trip.stops.length})</strong></div>
              <div className="stops">
                {trip.stops.map((stop) => {
                  const outlet = orderMap.get(stop.order_ids[0])?.outlet;
                  return (
                    <div className="stop-card" key={stop.id}>
                      <span className="stop-number">{stop.sequence_number}</span>
                      <div>
                        <strong>{outlet ? `${outlet.brand} · ${outlet.district}` : shortId(stop.outlet_id)}</strong>
                        <small>{stop.order_ids.map((id) => {
                          const o = orderMap.get(id);
                          return o ? `${shortId(id)} ${temperatureLabel(o.temperature_requirement)} ${o.order_weight_kg} kg ${o.order_volume_m3} m³` : shortId(id);
                        }).join(' · ')}</small>
                      </div>
                      <b>Arrive {formatTime(stop.arrival_at)} · serve {formatTime(stop.service_start_at)}–{formatTime(stop.departure_at)}</b>
                    </div>
                  );
                })}
              </div>
              {canPublish && !isPublished ? (
                <label className="dx-field">Driver user ID for this trip
                  <input
                    value={drivers[trip.id] ?? ''}
                    placeholder="Driver UUID"
                    aria-invalid={!!drivers[trip.id] && !UUID_PATTERN.test(drivers[trip.id].trim())}
                    onChange={(e) => setDrivers((d) => ({ ...d, [trip.id]: e.target.value }))}
                  />
                </label>
              ) : publishedDriver.get(trip.id) ? <Kv a="Driver" b={<span title={publishedDriver.get(trip.id)}>{shortId(publishedDriver.get(trip.id)!)}</span>} /> : null}
            </section>
          );
        })}
      </div>
      {!saved.trips.length && <section className="card"><Empty t="No trips in this revision" d="Every eligible order was deferred, or the day had no orders." /></section>}

      <section className="card">
        <h2>Deferred orders ({saved.deferrals.length})</h2>
        {saved.deferrals.length ? (
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead><tr><th>ORDER</th><th>OUTLET</th><th>REASON</th><th>SERVER EXPLANATION</th></tr></thead>
              <tbody>
                {saved.deferrals.map((d) => {
                  const o = orderMap.get(d.order_id);
                  return (
                    <tr key={d.order_id}>
                      <td title={d.order_id}>{shortId(d.order_id)}{o && <div className="dx-muted">{temperatureLabel(o.temperature_requirement)} · {o.order_weight_kg} kg · {o.order_volume_m3} m³</div>}</td>
                      <td>{o ? `${o.outlet.brand} · ${o.outlet.district}` : shortId(d.outlet_id)}</td>
                      <td><span className="dx-badge orange">{DEFERRAL_LABEL[d.reason_code]}</span></td>
                      <td>{d.reason_text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="dx-muted">No deferrals: every eligible order is served.</p>}
      </section>

      {canPublish && !isPublished && (
        <section className="card">
          <h2>Assign drivers and publish revision {saved.revision_number}</h2>
          <Alert t="No driver directory in the API">
            Enter each Driver&apos;s user ID (an active Driver assigned to this depot). The server rejects any other account.
          </Alert>
          {saved.trips.length > 0 && (
            <div className="dx-row">
              <label className="dx-field" style={{ flex: 1 }}>Same driver for every trip
                <input value={allDriver} placeholder="Driver UUID" onChange={(e) => setAllDriver(e.target.value)} />
              </label>
              <button className="dx-btn" disabled={!UUID_PATTERN.test(allDriver.trim())} onClick={() => setDrivers(Object.fromEntries(saved.trips.map((t) => [t.id, allDriver.trim()])))}>Apply to all trips</button>
            </div>
          )}
          <p className="dx-muted">
            Publishing revalidates this saved schedule against current orders, fleet, availability and weekly fuel. If anything changed
            the server rejects it and you run a new optimization. Trips and loading become visible to Loaders and Drivers only after publishing.
          </p>
          {error && <Alert k="e" t="Not published">{error.t}{error.uncertain && ' Publish again without changes to retry the same request.'}</Alert>}
          <button className="primary-button" disabled={busy || invalid} onClick={publish}>{busy ? 'Publishing…' : `Publish revision ${saved.revision_number} →`}</button>
          {invalid && saved.trips.length > 0 && <p className="dx-muted">Assign a valid driver ID to every trip first.</p>}
        </section>
      )}
    </>
  );
}

function PublicationCard({ publication, vehicles }: { publication: PublicationResponse; vehicles: Map<string, VehicleResponse> }) {
  return (
    <section className="card">
      <div className="dx-row sp">
        <h2>Published revision {publication.revision_number}</h2>
        <span className="dx-badge green">Revalidated at publish</span>
      </div>
      <Kv a="Published" b={`${formatDateTime(publication.published_at)} by ${shortId(publication.published_by)}`} />
      <Kv a="Served / deferred orders" b={`${publication.served_order_count} / ${publication.deferred_order_count}`} />
      <div className="dx-table-wrap">
        <table className="dx-table">
          <thead><tr><th>TRIP</th><th>VEHICLE</th><th>DRIVER</th><th>DEPART</th><th>RETURN</th><th>FUEL</th></tr></thead>
          <tbody>
            {publication.trips.map((t) => {
              const v = vehicles.get(t.vehicle_id);
              return (
                <tr key={t.trip_id}>
                  <td>{t.trip_number}</td><td>{v ? vehicleLabel(v) : shortId(t.vehicle_id)}</td>
                  <td title={t.driver_id}>{shortId(t.driver_id)}</td>
                  <td>{formatTime(t.departure_at)}</td><td>{formatTime(t.return_at)}</td><td>{t.fuel_l} L</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h2 style={{ marginTop: 14 }}>Weekly fuel at publication</h2>
      <div className="dx-table-wrap">
        <table className="dx-table">
          <thead><tr><th>VEHICLE</th><th>WEEK FROM</th><th>QUOTA</th><th>CONSUMED</th><th>RESERVED</th><th>REMAINING</th></tr></thead>
          <tbody>
            {publication.fuel_balances.map((b) => {
              const v = vehicles.get(b.vehicle_id);
              return (
                <tr key={b.vehicle_id}>
                  <td>{v ? vehicleLabel(v) : shortId(b.vehicle_id)}</td><td>{formatDate(b.week_start)}</td>
                  <td>{b.weekly_quota_l} L</td><td>{b.consumed_l} L</td><td>{b.reserved_l} L</td><td>{b.remaining_l} L</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dx-muted">Loaders and Drivers now see these trips. Republishing or editing a published plan is not supported by the API.</p>
    </section>
  );
}
