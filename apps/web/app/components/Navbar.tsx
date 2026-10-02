import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="search">
        <span>⌕</span>

        <input
          type="text"
          placeholder="Search orders, trips, vehicles"
        />

        <kbd>⌘K</kbd>
      </div>

      <div className="navbar-right">
        <span className="system-live">
          ● SYSTEM LIVE
        </span>

        <span className="date">
          11:42 AM • Sep 25, 2026
        </span>

        <button className="filter-button">
          ☷ Filter Fleet
        </button>

        <Link
          href="/dispatcher/planning"
          className="plan-button"
        >
          Plan Orders →
        </Link>

        <button className="notification">
          ♧
        </button>

        <div className="user">
          <div className="avatar">
            TP
          </div>

          <div>
            <strong>Tharindu Perera</strong>
            <span>Desk 02 • Dispatcher</span>
          </div>
        </div>
      </div>
    </header>
  );
}