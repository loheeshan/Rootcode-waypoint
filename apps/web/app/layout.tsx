import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Waypoint | Operations',
  description:
    'Delivery operations workspace',
};

/* Each role app renders its own shell: /dispatcher (app/dispatcher/layout.tsx) and /store. */
export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
