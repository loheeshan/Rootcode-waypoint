"use client";
import type { GoFn } from "../data/mock";

export default function Header({ off, unread, go }: { off: boolean; unread: number; go: GoFn }) {
  return (
    <header>
      <span className="m">{off ? "Offline · last synced 06:12" : "Cutoff 16:00 · Asia/Colombo"}</span>
      <button className="bell" aria-label="Notifications" onClick={() => go("notif")}>
        🔔{unread > 0 && <span className="dot">{unread}</span>}
      </button>
      <span className="av">C</span>
    </header>
  );
}
