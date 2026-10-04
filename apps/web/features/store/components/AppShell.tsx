"use client";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import type { GoFn } from "../data/store";

/* One layout for every signed-in page: sidebar + header + content */
export default function AppShell({ route, go, context, email, children }: {
  route: string; go: GoFn; context: string; email: string; children: ReactNode;
}) {
  return (
    <div id="app">
      <Sidebar route={route} go={go} context={context} />
      <main>
        <Header go={go} email={email} />
        <div className="pg">{children}</div>
      </main>
    </div>
  );
}
