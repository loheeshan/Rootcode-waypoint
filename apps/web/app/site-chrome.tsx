'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Routes that render their own full application shell (no global Waypoint header / <main>). */
const OWN_SHELL = ['/store'];

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (OWN_SHELL.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <>{children}</>;
  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">Waypoint</Link>
        <nav aria-label="Main navigation"><Link href="/dispatcher">Dispatcher</Link><Link href="/store">Store Manager</Link></nav>
      </header>
      <main>{children}</main>
    </>
  );
}
