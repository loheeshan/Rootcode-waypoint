'use client';

import Link from 'next/link';
import { useDispatcher } from '../../features/dispatcher/components/DispatcherShell';
import { formatDate } from '../../features/dispatcher/data/dispatcher';

/** Depot and date chosen here scope every Dispatcher page; the user comes from /me. */
export default function Navbar() {
  const { user, depots, depotId, setDepotId, day, setDay } = useDispatcher();

  return (
    <header className="navbar">
      <div className="navbar-right">
        <label className="date">
          Depot{' '}
          <select
            className="filter-button"
            value={depotId}
            onChange={(event) => setDepotId(event.target.value)}
            aria-label="Depot"
          >
            {depots.map((depot) => (
              <option key={depot.id} value={depot.id}>{depot.name}</option>
            ))}
          </select>
        </label>

        <label className="date">
          Delivery date{' '}
          <input
            className="filter-button"
            type="date"
            value={day}
            required
            onChange={(event) => event.target.value && setDay(event.target.value)}
            aria-label="Delivery date (Colombo)"
          />
        </label>

        <span className="date">{formatDate(day)} · Asia/Colombo</span>
      </div>

      <div className="navbar-right">
        <Link
          href="/dispatcher/planning"
          className="plan-button"
        >
          Plan Orders →
        </Link>

        <div className="user">
          <div className="avatar">
            {user.email.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <strong>{user.email}</strong>
            <span>Dispatcher</span>
          </div>
        </div>
      </div>
    </header>
  );
}
