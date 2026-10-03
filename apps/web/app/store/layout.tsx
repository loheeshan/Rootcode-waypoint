import type { ReactNode } from 'react';
import './store.css';

/* Store Manager route: scoped styles only. The global Waypoint header/<main> are skipped for /store
   by app/site-chrome.tsx, and the Store Manager renders its own sidebar, header and <main>. */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return <div className="store-app">{children}</div>;
}
