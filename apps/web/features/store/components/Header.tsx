"use client";
import type { GoFn } from "../data/store";

export default function Header({ go, email }: { go: GoFn; email: string }) {
  return (
    <header>
      <span className="m">Cutoff 16:00 · Asia/Colombo</span>
      <button className="bell" aria-label="Notifications" onClick={() => go("notif")}>🔔</button>
      <span className="av" title={email} aria-label={`Signed in as ${email}`}>{email.charAt(0).toUpperCase()}</span>
    </header>
  );
}
