"use client";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import type { GoFn, SetFn, State } from "../data/mock";

/* One layout for every signed-in page: sidebar + header + content */
export default function AppShell({ route, go, S, set, unread, children }: { route: string; go: GoFn; S: State; set: SetFn; unread: number; children: ReactNode }) {
  return (
    <div id="app">
      <Sidebar route={route} go={go} S={S} set={set} />
      <main>
        <Header off={S.off} unread={unread} go={go} />
        <div className="pg">
          {S.off && (
            <div className="al w"><b>You are offline</b>Last saved orders and your draft remain available on this device. Last synced 06:12 — data may be stale.</div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
