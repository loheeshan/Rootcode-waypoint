import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = { title: 'Waypoint | Operations', description: 'Delivery operations starter workspace' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><header className="topbar"><Link className="brand" href="/">Waypoint</Link><nav aria-label="Main navigation"><Link href="/dispatcher">Dispatcher</Link><Link href="/store">Store Manager</Link></nav></header><main>{children}</main></body></html>;
}
