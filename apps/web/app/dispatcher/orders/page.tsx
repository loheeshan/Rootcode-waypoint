'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { OrderStatus } from '@waypoint/api-contracts';
import '../../order.css';
import { useDispatcher } from '../../../features/dispatcher/components/DispatcherShell';
import { LoadError, Loading, OrderBadge, Pager, useLoad } from '../../../features/dispatcher/components/ui';
import {
  ORDER_STATUSES, ORDER_STATUS_LABEL, formatDate, listOrders, shortId, sumDecimals, temperatureLabel, windowLabel,
} from '../../../features/dispatcher/data/dispatcher';

const PAGE = 20;

/** Orders of the Dispatcher's depots, filtered and paginated by the server. */
export default function OrdersPage() {
  const { depotId, depots, day, onExpired } = useDispatcher();
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('CONFIRMED');
  const [allDates, setAllDates] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const depotName = depots.find((d) => d.id === depotId)?.name ?? '';

  const key = `${depotId}:${day}:${status}:${allDates}:${page}`;
  const list = useLoad(() => listOrders({
    depot_id: depotId,
    status: status === 'ALL' ? undefined : status,
    requested_delivery_date: allDates ? undefined : day,
    limit: PAGE,
    offset: page * PAGE,
  }), onExpired, key);

  const q = search.trim().toLowerCase();
  const items = (list.data?.items ?? []).filter((o) => !q
    || o.id.toLowerCase().startsWith(q)
    || o.outlet.brand.toLowerCase().includes(q)
    || o.outlet.district.toLowerCase().includes(q));
  const total = list.data?.total ?? 0;
  const chosen = (list.data?.items ?? []).filter((o) => selected.includes(o.id));
  const reset = () => { setPage(0); setSelected([]); };

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  const toggleAll = () => setSelected(selected.length === items.length ? [] : items.map((o) => o.id));

  return (
    <div className="orders-page">
      <section className="orders-header-card">
        <div>
          <div className="orders-title-row">
            <h1>Order Queue</h1>
            <span className="cutoff-badge">Server cutoff applied</span>
          </div>
          <p>
            {depotName} · {allDates ? 'all delivery dates' : formatDate(day)}. Delivery dates are the
            accepted dates after the 16:00 Colombo Store cutoff.
          </p>
        </div>

        <div className="orders-header-actions">
          <button className="orders-secondary-button" onClick={list.reload} disabled={list.loading}>
            ↻ Refresh
          </button>
          <Link className="orders-primary-button" href="/dispatcher/planning">
            Plan {formatDate(day)} →
          </Link>
        </div>
      </section>

      <div className="queue-actions">
        <button className={`queue-tab ${allDates ? '' : 'active'}`} onClick={() => { setAllDates(false); reset(); }}>
          {formatDate(day)}
        </button>
        <button className={`queue-tab ${allDates ? 'active' : ''}`} onClick={() => { setAllDates(true); reset(); }}>
          All dates
        </button>
      </div>

      <section className="orders-summary">
        <div>
          <strong>{list.loading ? '…' : total}</strong>
          <span>{status === 'ALL' ? 'ORDERS' : ORDER_STATUS_LABEL[status].toUpperCase() + ' ORDERS'}</span>
        </div>
        <div className="summary-spacer" />
        <div className="payload-stat">
          <strong>{sumDecimals(chosen.map((o) => o.order_weight_kg))} kg</strong>
          <small>SELECTED WEIGHT</small>
        </div>
        <div className="payload-stat">
          <strong>{sumDecimals(chosen.map((o) => o.order_volume_m3))} m³</strong>
          <small>SELECTED VOLUME</small>
        </div>
      </section>

      <div className="order-category-row">
        <div className="order-category-tabs">
          {(['ALL', ...ORDER_STATUSES] as const).map((s) => (
            <button key={s} className={status === s ? 'active' : ''} onClick={() => { setStatus(s); reset(); }}>
              <span className="category-dot" />
              {s === 'ALL' ? 'All statuses' : ORDER_STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="order-search-box">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this page: order ID, outlet, district"
            aria-label="Search this page"
          />
        </div>
      </div>

      <section className="orders-table-card">
        <div className="table-toolbar">
          <div>
            <button className="select-all-button" onClick={toggleAll} aria-label="Select all on this page">
              {selected.length === items.length && items.length > 0 ? '☑' : '☐'}
            </button>
            <strong>{selected.length ? `${selected.length} orders selected` : 'No orders selected'}</strong>
            <span>Selection totals are exact sums of the server quantities.</span>
          </div>
        </div>

        {list.loading ? <Loading t="Loading orders…" /> : list.error ? <LoadError error={list.error} retry={list.reload} /> : (
          <div className="orders-table-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th className="checkbox-column">□</th>
                  <th>ORDER</th>
                  <th>OUTLET & DISTRICT</th>
                  <th>DEPOT</th>
                  <th>WEIGHT</th>
                  <th>VOLUME</th>
                  <th>TEMPERATURE</th>
                  <th>DELIVERY WINDOW</th>
                  <th>ACCESS</th>
                  <th>DELIVERY DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => (
                  <tr key={order.id}>
                    <td className="checkbox-column">
                      <button className="row-checkbox" onClick={() => toggle(order.id)} aria-label={`Select order ${shortId(order.id)}`}>
                        {selected.includes(order.id) ? '☑' : '□'}
                      </button>
                    </td>
                    <td><strong className="order-id" title={order.id}>{shortId(order.id)}</strong></td>
                    <td>
                      <div className="outlet-cell">
                        <strong>{order.outlet.brand}</strong>
                        <small>{order.outlet.district} · {order.outlet.dock_type} dock</small>
                      </div>
                    </td>
                    <td>{order.depot.name}</td>
                    <td><strong>{order.order_weight_kg} kg</strong></td>
                    <td><strong>{order.order_volume_m3} m³</strong></td>
                    <td>
                      <span className={`temperature-badge ${order.temperature_requirement}`}>
                        {order.temperature_requirement === 'chilled' ? '❄' : '☀'} {temperatureLabel(order.temperature_requirement)}
                      </span>
                    </td>
                    <td>
                      <strong className="delivery-window">{windowLabel(order.outlet.window_open_time, order.outlet.window_close_time)}</strong>
                      {order.outlet.mall_window && <small> · mall</small>}
                    </td>
                    <td>
                      {order.outlet.parking_constraint === 'van_only'
                        ? <span className="van-only-badge">♙ Van only</span>
                        : <span className="normal-access">Any vehicle</span>}
                    </td>
                    <td>{formatDate(order.requested_delivery_date)}</td>
                    <td><OrderBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!list.loading && !list.error && items.length === 0 && (
          <div className="empty-orders">
            <strong>{total ? 'No matches on this page' : 'No orders'}</strong>
            <p>{total ? 'Clear the search or open another page.' : 'No orders match this depot, date and status.'}</p>
          </div>
        )}

        <div className="orders-table-footer">
          <span>Showing {items.length} of {total} orders</span>
          <Pager total={total} page={page} size={PAGE} busy={list.loading} onPage={(p) => { setPage(p); setSelected([]); }} />
        </div>
      </section>
    </div>
  );
}
