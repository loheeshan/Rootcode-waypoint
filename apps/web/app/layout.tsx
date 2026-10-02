import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

export const metadata: Metadata = {
  title: 'Waypoint | Operations',
  description:
    'Delivery operations workspace',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <Sidebar />

          <div className="main-layout">
            <Navbar />

            <main className="page">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}