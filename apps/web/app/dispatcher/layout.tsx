import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import DispatcherShell from '../../features/dispatcher/components/DispatcherShell';

export const metadata: Metadata = { title: 'Dispatcher | Waypoint' };

/* Dispatcher sign-in gate, sidebar and navbar; the API still authorizes every request. */
export default function DispatcherLayout({ children }: { children: ReactNode }) {
  return <DispatcherShell>{children}</DispatcherShell>;
}
