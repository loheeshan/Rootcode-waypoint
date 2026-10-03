"use client";
import type { GoFn, SetFn, State } from "../data/mock";

export const NAV: [string, string][] = [["home", "Home"], ["orders", "Orders"], ["new", "New order"], ["deliv", "Deliveries"], ["receipts", "Receipts"], ["settings", "Settings"], ["daily", "Daily replenishment"]];
type Flag = "late" | "off" | "fail" | "loadFail";

export default function Sidebar({ route, go, S, set }: { route: string; go: GoFn; S: State; set: SetFn }) {
  const link = (k: string, l: string) => (
    <a key={k} tabIndex={0} role="link" className={route === k ? "on" : ""} onClick={() => go(k)} onKeyDown={(e) => e.key === "Enter" && go(k)}>{l}</a>
  );
  const flag = (key: Flag, label: string) => (
    <label><input type="checkbox" checked={S[key]} onChange={(e) => set({ [key]: e.target.checked } as Partial<State>)} /> {label}</label>
  );
  return (
    <aside>
      <div className="logo">Waypoint</div>
      <div className="role">STORE MANAGER</div>
      <div className="ctx">OUT017 · Fresh · Colombo 03</div>
      <nav>{NAV.map(([k, l]) => link(k, l))}</nav>
      <nav>{link("support", "Support")}</nav>
      <div className="demo">
        <b>Demo controls</b>
        {flag("late", "Cutoff passed (16:20)")}
        {flag("off", "Offline")}
        {flag("fail", "Fail next submit")}
        {flag("loadFail", "Orders load failure")}
        <button onClick={() => set({ signed: false, expired: true })}>Expire session</button>
      </div>
    </aside>
  );
}
