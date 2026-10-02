'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    {
      name: 'Dashboard',
      href: '/dispatcher',
      icon: '▦',
    },
    {
      name: 'Orders',
      href: '/dispatcher/orders',
      icon: '▤',
    },
    {
      name: 'Planning',
      href: '/dispatcher/planning',
      icon: '⌘',
    },
    {
      name: 'Trips',
      href: '/dispatcher/trips',
      icon: '▱',
    },
    {
      name: 'Fleet',
      href: '/dispatcher/fleet',
      icon: '▣',
    },
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">➤</div>

        <div>
          <strong>Waypoint</strong>
          <span>LOGISTICS OS</span>
        </div>
      </div>

      <p className="sidebar-title">
        OPERATIONS
      </p>

      <nav>
        {links.map((link) => {
          const active =
            pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? 'sidebar-link active'
                  : 'sidebar-link'
              }
            >
              <span>{link.icon}</span>
              {link.name}

              {link.name === 'Planning' && (
                <small>12</small>
              )}
            </Link>
          );
        })}
      </nav>

      <p className="sidebar-title">
        FACILITIES
      </p>

      <Link
        href="/warehouses"
        className="sidebar-link"
      >
        <span>⌂</span>
        Warehouses
      </Link>

      <p className="sidebar-title">
        INSIGHTS
      </p>

      <Link
        href="/analytics"
        className="sidebar-link"
      >
        <span>⌁</span>
        Analytics
      </Link>

      <Link
        href="/reports"
        className="sidebar-link"
      >
        <span>▤</span>
        Reports
      </Link>

      <p className="sidebar-title">
        SYSTEM
      </p>

      <Link
        href="/settings"
        className="sidebar-link"
      >
        <span>⚙</span>
        Settings
      </Link>
    </aside>
  );
}