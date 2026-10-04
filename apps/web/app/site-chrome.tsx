'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

/** Routes that render their own full application shell (no global Waypoint header / <main>). */
const OWN_SHELL = ['/store'];

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (OWN_SHELL.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <>{children}</>;
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-layout">
        <Navbar />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
