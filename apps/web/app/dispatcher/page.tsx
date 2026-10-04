'use client';

import Link from 'next/link';
import { useDispatcher } from '../../features/dispatcher/components/DispatcherShell';
import { LoadError, Loading, TripBadge, useLoad } from '../../features/dispatcher/components/ui';
import {
  EXCEPTION_KINDS, EXCEPTION_LABEL, ORDER_STATUSES, ORDER_STATUS_LABEL, TRIP_STATUSES, formatDate, formatTime,
  getLive, listOperationTrips, listOrders, shortId,
} from '../../features/dispatcher/data/dispatcher';

/** Day overview from the operations API; counts only, no derived KPIs the API does not return. */
export default function DispatcherDashboard() {
  const { depotId, day, onExpired } = useDispatcher();
  const key = `${depotId}:${day}`;
  const live = useLoad(() => getLive({ depot_id: depotId, delivery_date: day }), onExpired, key);
  const toPlan = useLoad(() => listOrders({ depot_id: depotId, requested_delivery_date: day, status: 'CONFIRMED', limit: 1 }), onExpired, key);
  const trips = useLoad(() => listOperationTrips({ depot_id: depotId, delivery_date: day, limit: 5 }), onExpired, key);

  const s = live.data;
  const tripTotal = s ? TRIP_STATUSES.reduce((n, t) => n + s.trips_by_status[t], 0) : 0;
  const orderTotal = s ? ORDER_STATUSES.reduce((n, t) => n + s.orders_by_status[t], 0) : 0;
  const failures = s ? s.exceptions.LOAD_MISSING + s.exceptions.LOAD_DAMAGED + s.exceptions.DELIVERY_FAILED + s.exceptions.SYNC_CONFLICT : 0;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h1>Dashboard</h1>
          <p>{formatDate(day)} · published plans, loading, deliveries and exceptions from the server.</p>
        </div>
      </div>

      {live.loading ? <Loading t="Loading today's operation…" /> : live.error ? <LoadError error={live.error} retry={live.reload} /> : s && (
        <>
          <div className="stats">
            <div className="stat-card">
              <span>TO PLAN</span>
              <strong>{toPlan.data?.total ?? '…'}</strong>
              <small>Confirmed orders not yet published</small>
            </div>
            <div className="stat-card">
              <span>IN PUBLISHED PLANS</span>
              <strong>{orderTotal}</strong>
              <small>{s.deferred_orders} deferred</small>
            </div>
            <div className="stat-card">
              <span>TRIPS</span>
              <strong>{s.trips_by_status.IN_PROGRESS} <small>/ {tripTotal}</small></strong>
              <small>In progress / published</small>
            </div>
            <div className="stat-card">
              <span>DELIVERED STOPS</span>
              <strong>{s.delivery.delivered_stops} <small>/ {s.delivery.stops_requiring_visit}</small></strong>
              <small>{s.delivery.failed_stops} failed</small>
            </div>
            <div className={`stat-card ${failures ? 'danger' : ''}`}>
              <span>EXCEPTIONS</span>
              <strong>{failures}</strong>
              <small>{s.exceptions.RECEIPT_PENDING} receipts pending</small>
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="card">
              <h2>Delivery Progress</h2>
              <div className="metrics">
                <div><strong>{s.delivery.delivered_stops}</strong><span>Delivered stops</span></div>
                <div><strong>{s.delivery.open_stops}</strong><span>Open stops</span></div>
                <div><strong>{s.delivery.failed_stops}</strong><span>Failed stops</span></div>
                <div><strong>{s.delivery.receipts_confirmed}</strong><span>Receipts confirmed</span></div>
              </div>
            </section>

            <section className="card">
              <h2>Loading Progress</h2>
              <div className="metrics">
                <div><strong>{s.loading.loaded}</strong><span>Loaded</span></div>
                <div><strong>{s.loading.pending}</strong><span>Pending</span></div>
                <div><strong>{s.loading.missing}</strong><span>Missing</span></div>
                <div><strong>{s.loading.damaged}</strong><span>Damaged</span></div>
              </div>
            </section>
          </div>

          <section className="card">
            <div className="card-header">
              <h2>Needs Attention</h2>
              <Link href="/dispatcher/trips">View all exceptions →</Link>
            </div>
            <div className="attention">
              {EXCEPTION_KINDS.map((kind) => (
                <div key={kind}>
                  <span>{EXCEPTION_LABEL[kind].toUpperCase()}</span>
                  <strong>{s.exceptions[kind]}</strong>
                </div>
              ))}
            </div>
          </section>

          <div className="dashboard-grid">
            <section className="card">
              <h2>Orders in Published Plans</h2>
              <div className="ready">
                <div>
                  <strong>{toPlan.data?.total ?? '…'} CONFIRMED, WAITING FOR A PUBLISHED PLAN</strong>
                  <p>{s.published_plans} published plan(s) · {s.draft_plans} draft plan(s) for this date</p>
                </div>
                <Link href="/dispatcher/planning">Open Planning →</Link>
              </div>
              <div className="order-status">
                {ORDER_STATUSES.filter((st) => st !== 'CONFIRMED').map((st) => (
                  <span key={st}>{ORDER_STATUS_LABEL[st]} ({s.orders_by_status[st]})</span>
                ))}
              </div>
            </section>

            <section className="card">
              <h2>Trips by Status</h2>
              <div className="order-status">
                {TRIP_STATUSES.map((st) => <span key={st}><TripBadge status={st} /> {s.trips_by_status[st]}</span>)}
              </div>
            </section>
          </div>
        </>
      )}

      <section className="card">
        <div className="card-header">
          <h2>Trips</h2>
          <Link href="/dispatcher/trips">View all trips →</Link>
        </div>
        {trips.loading ? <Loading /> : trips.error ? <LoadError error={trips.error} retry={trips.reload} /> : !trips.data?.items.length ? (
          <p className="dx-muted">No published trips for this date.</p>
        ) : trips.data.items.map(({ trip, delivery }) => (
          <div className="trip" key={trip.trip_id}>
            <strong title={trip.trip_id}>{shortId(trip.vehicle_id)} · Trip {trip.trip_number}</strong>
            <span>{formatTime(trip.departure_at)}–{formatTime(trip.return_at)} <TripBadge status={trip.status} /></span>
            <strong>{delivery.delivered_stops + delivery.failed_stops}/{delivery.stops_requiring_visit} stops</strong>
          </div>
        ))}
      </section>
    </>
  );
}
