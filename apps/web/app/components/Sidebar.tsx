'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import FleetModal from './dispatcher/FleetModal';
import WarehouseModal from './dispatcher/WarehouseModal';
import ReportsModal from './dispatcher/ReportsModal';

export default function Sidebar() {
  const pathname = usePathname();

  const [modal, setModal] = useState<
    'fleet' | 'warehouse' | 'reports' | null
  >(null);

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
  ];

  return (
    <>
      <aside className="sidebar">

        {/* LOGO - KEEPING YOUR EXISTING STYLE */}
        <div className="logo">
          <div className="logo-icon">➤</div>

          <div>
            <strong>Waypoint</strong>
            <span>LOGISTICS OS</span>
          </div>
        </div>

        {/* OPERATIONS */}
        <p className="sidebar-title">
          OPERATIONS
        </p>

        <nav>
          {links.map((link) => {
            const active = pathname === link.href;

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

          {/* FLEET - MODAL */}
          <button
            type="button"
            className="sidebar-link sidebar-button"
            onClick={() => setModal('fleet')}
          >
            <span>▣</span>
            Fleet
          </button>
        </nav>

        {/* FACILITIES */}
        <p className="sidebar-title">
          FACILITIES
        </p>

        {/* WAREHOUSES - MODAL */}
        <button
          type="button"
          className="sidebar-link sidebar-button"
          onClick={() => setModal('warehouse')}
        >
          <span>⌂</span>
          Warehouses
        </button>

        {/* INSIGHTS */}
        <p className="sidebar-title">
          INSIGHTS
        </p>

        <Link
          href="/dispatcher/analytics"
          className={
            pathname === '/dispatcher/analytics'
              ? 'sidebar-link active'
              : 'sidebar-link'
          }
        >
          <span>⌁</span>
          Analytics
        </Link>

        {/* REPORTS - MODAL */}
        <button
          type="button"
          className="sidebar-link sidebar-button"
          onClick={() => setModal('reports')}
        >
          <span>▤</span>
          Reports
        </button>

        {/* SYSTEM */}
        <p className="sidebar-title">
          SYSTEM
        </p>

        <Link
          href="/settings"
          className={
            pathname === '/settings'
              ? 'sidebar-link active'
              : 'sidebar-link'
          }
        >
          <span>⚙</span>
          Settings
        </Link>

      </aside>

      {/* =====================================
          MODALS
          ===================================== */}

      {modal === 'fleet' && (
        <FleetModal
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'warehouse' && (
        <WarehouseModal
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'reports' && (
        <ReportsModal
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}