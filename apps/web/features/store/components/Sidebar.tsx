"use client";
import type { GoFn } from "../data/store";

export const NAV: [string, string][] = [["home", "Home"], ["orders", "Orders"], ["new", "New order"], ["deliv", "Deliveries"], ["receipts", "Receipts"], ["settings", "Settings"], ["daily", "Daily replenishment"]];

export default function Sidebar({ route, go, context }: { route: string; go: GoFn; context: string }) {
  const link = (k: string, l: string) => (
    <a key={k} tabIndex={0} role="link" className={route === k ? "on" : ""} onClick={() => go(k)} onKeyDown={(e) => e.key === "Enter" && go(k)}>{l}</a>
  );
  return (
    <aside>
      <div className="logo">Waypoint</div>
      <div className="role">STORE MANAGER</div>
      <div className="ctx">{context}</div>
      <nav>{NAV.map(([k, l]) => link(k, l))}</nav>
      <nav>{link("support", "Support")}</nav>
    </aside>
  );
}
