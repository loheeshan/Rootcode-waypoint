"use client";
import type { ReactNode } from "react";
import { cls } from "../data/mock";
import type { Order, GoFn } from "../data/mock";

/* ---------- small components ---------- */
export const Badge = ({ o }: { o: Order }) => <span className={`b ${cls(o)}`}>{o.st}</span>;
export const Alert = ({ k = "i", t, children }: { k?: string; t: string; children?: ReactNode }) => <div className={`al ${k}`}><b>{t}</b>{children}</div>;
export const Kv = ({ a, b }: { a: string; b: ReactNode }) => <div className="kv"><span>{a}</span><b>{b}</b></div>;
export const Empty = ({ t, d, btn, onClick }: { t: string; d: string; btn?: string; onClick?: () => void }) => (
  <div className="es"><h2>{t}</h2><p className="m">{d}</p>{btn && <button className="p" onClick={onClick}>{btn}</button>}</div>
);
export const OrderCard = ({ o, go }: { o: Order; go: GoFn }) => (
  <div className="card ol row sp" tabIndex={0} role="button" onClick={() => go("order", o.id)} onKeyDown={(e) => e.key === "Enter" && go("order", o.id)}>
    <div><b>{o.id}</b> <Badge o={o} /><div className="m">{o.ty}</div><div className="m">{o.info}</div></div><span className="m">View ›</span>
  </div>
);
export const Modal = ({ children, onClose }: { children: ReactNode; onClose: () => void }) => (
  <div className="ov" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && onClose()}><div className="md">{children}</div></div>
);
