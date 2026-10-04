"use client";
import type { ReactNode } from "react";
import { ApiError, errorMessage, type OrderStatus, type TripStatus } from "@waypoint/api-contracts";
import { ORDER_STATUS_LABEL, TRIP_STATUS_LABEL } from "../data/dispatcher";

export { useLoad } from "../../store/components/ui";

export const Alert = ({ k = "i", t, children }: { k?: "i" | "w" | "e" | "s"; t: string; children?: ReactNode }) => (
  <div className={`dx-alert ${k}`} role={k === "e" ? "alert" : undefined}><b>{t}</b>{children}</div>
);
export const Kv = ({ a, b }: { a: string; b: ReactNode }) => <div className="dx-kv"><span>{a}</span><b>{b}</b></div>;
export const Loading = ({ t = "Loading…" }: { t?: string }) => <p className="dx-muted" role="status">{t}</p>;
export const Empty = ({ t, d, children }: { t: string; d?: string; children?: ReactNode }) => (
  <div className="dx-state"><h2>{t}</h2>{d && <p>{d}</p>}{children}</div>
);

/** Load failure: network, forbidden and missing are distinct from other server errors. */
export function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  const offline = !(error instanceof ApiError);
  const status = error instanceof ApiError ? error.status : 0;
  return (
    <div className="dx-state">
      <h2>{offline ? "Can't reach Waypoint" : status === 403 ? "No access" : status === 404 ? "Not found" : "We couldn't load this"}</h2>
      <p>{offline ? "Check your connection and try again." : errorMessage(error, status === 403 ? "This account has no access to this depot." : "Try again shortly.")}</p>
      {status !== 403 && <button className="dx-btn p" onClick={retry}>Try again</button>}
    </div>
  );
}

const ORDER_TONE: Record<OrderStatus, string> = {
  CONFIRMED: "blue", PLANNED: "cyan", DEFERRED: "orange", LOADING: "blue",
  OUT_FOR_DELIVERY: "blue", DELIVERED: "green", RECEIPT_CONFIRMED: "green",
};
const TRIP_TONE: Record<TripStatus, string> = {
  PLANNED: "", LOADING: "blue", READY: "cyan", IN_PROGRESS: "blue", COMPLETED: "green",
};
export const OrderBadge = ({ status }: { status: OrderStatus }) => <span className={`dx-badge ${ORDER_TONE[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
export const TripBadge = ({ status }: { status: TripStatus }) => <span className={`dx-badge ${TRIP_TONE[status]}`}>{TRIP_STATUS_LABEL[status]}</span>;

export function Pager({ total, page, size, busy, onPage }: { total: number; page: number; size: number; busy?: boolean; onPage: (page: number) => void }) {
  if (total <= size) return null;
  return (
    <div className="dx-row" style={{ marginTop: 12 }}>
      <button className="dx-btn" disabled={page === 0 || busy} onClick={() => onPage(page - 1)}>‹ Previous</button>
      <span className="dx-muted">Page {page + 1} of {Math.ceil(total / size)} · {total} total</span>
      <button className="dx-btn" disabled={(page + 1) * size >= total || busy} onClick={() => onPage(page + 1)}>Next ›</button>
    </div>
  );
}
