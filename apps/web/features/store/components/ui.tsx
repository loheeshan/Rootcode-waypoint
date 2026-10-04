"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError, errorMessage, type OrderResponse, type OrderStatus } from "@waypoint/api-contracts";
import { BADGE, STATUS_LABEL, formatDate, shortId, temperatureLabel } from "../data/store";
import type { GoFn } from "../data/store";

/* ---------- small components ---------- */
export const Badge = ({ status }: { status: OrderStatus }) => <span className={`b ${BADGE[status]}`}>{STATUS_LABEL[status]}</span>;
export const Alert = ({ k = "i", t, children }: { k?: string; t: string; children?: ReactNode }) => <div className={`al ${k}`} role={k === "e" ? "alert" : undefined}><b>{t}</b>{children}</div>;
export const Kv = ({ a, b }: { a: string; b: ReactNode }) => <div className="kv"><span>{a}</span><b>{b}</b></div>;
export const Empty = ({ t, d, btn, onClick }: { t: string; d: string; btn?: string; onClick?: () => void }) => (
  <div className="es"><h2>{t}</h2><p className="m">{d}</p>{btn && <button className="p" onClick={onClick}>{btn}</button>}</div>
);
export const Loading = ({ t = "Loading…" }: { t?: string }) => <p className="m" role="status">{t}</p>;
export const OrderCard = ({ o, go }: { o: OrderResponse; go: GoFn }) => (
  <div className="card ol row sp" tabIndex={0} role="button" onClick={() => go("order", o.id)} onKeyDown={(e) => e.key === "Enter" && go("order", o.id)}>
    <div>
      <b>{shortId(o.id)}</b> <Badge status={o.status} />
      <div className="m">{temperatureLabel(o.temperature_requirement)} · {o.order_weight_kg} kg · {o.order_volume_m3} m³</div>
      <div className="m">Delivery {formatDate(o.requested_delivery_date)}</div>
    </div><span className="m">View ›</span>
  </div>
);
export const Modal = ({ children, onClose }: { children: ReactNode; onClose: () => void }) => (
  <div className="ov" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && onClose()}><div className="md">{children}</div></div>
);

/** Shared failure view: forbidden and network errors are distinct from other failures. */
export function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  const offline = !(error instanceof ApiError);
  const forbidden = error instanceof ApiError && error.status === 403;
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <div className="es">
      <h2>{offline ? "Can't reach Waypoint" : forbidden ? "No access" : missing ? "Not found" : "We couldn't load this"}</h2>
      <p className="m">{offline ? "Check your connection and try again." : forbidden ? "This account cannot view this outlet's orders." : errorMessage(error, "Try again shortly.")}</p>
      {!forbidden && !missing && <button className="p" onClick={retry}>Try again</button>}
    </div>
  );
}

/**
 * Loads server data for a view. A 401 is passed to `onExpired` (the session ended);
 * other errors are returned for the view to render.
 */
export function useLoad<T>(load: () => Promise<T>, onExpired: () => void, key: unknown = null) {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>(
    { data: null, error: null, loading: true },
  );
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => active && setState({ data, error: null, loading: false }),
      (error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) onExpired();
        setState({ data: null, error, loading: false });
      },
    );
    return () => { active = false; };
    // `load` is recreated each render; reload on key or explicit retry only.
  }, [key, attempt]);
  return { ...state, reload };
}
