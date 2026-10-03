import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SiteChrome from './site-chrome';
import './globals.css';
export const metadata: Metadata = { title: 'Waypoint | Operations', description: 'Delivery operations starter workspace' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><SiteChrome>{children}</SiteChrome></body></html>;
}
