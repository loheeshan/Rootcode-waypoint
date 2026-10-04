/**
 * Store Manager data access and view helpers. All data comes from the scoped Store API
 * through the same-origin session proxy; nothing here is mocked or stored in the browser.
 */
import type {
  OrderCreateRequest,
  OrderCreateResponse,
  OrderListResponse,
  OrderResponse,
  OrderStatus,
  ReceiptResponse,
} from "@waypoint/api-contracts";
import { backend } from "../../../lib/auth-client";

export type GoFn = (route: string, id?: string | null) => void;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  CONFIRMED: "Confirmed",
  PLANNED: "Planned",
  DEFERRED: "Deferred",
  LOADING: "Loading",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered · confirm receipt",
  RECEIPT_CONFIRMED: "Receipt confirmed",
};
/** CSS badge class per status (existing Store styles). */
export const BADGE: Record<OrderStatus, string> = {
  CONFIRMED: "Active",
  PLANNED: "Planned",
  DEFERRED: "Deferred",
  LOADING: "Active",
  OUT_FOR_DELIVERY: "Active",
  DELIVERED: "Needs",
  RECEIPT_CONFIRMED: "Confirmed",
};
export const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];
export const IN_PROGRESS: OrderStatus[] = ["CONFIRMED", "PLANNED", "LOADING", "OUT_FOR_DELIVERY"];
export const STAGES: [OrderStatus, string][] = [
  ["CONFIRMED", "Confirmed"],
  ["PLANNED", "Planned"],
  ["LOADING", "Loading"],
  ["OUT_FOR_DELIVERY", "Out for delivery"],
  ["DELIVERED", "Delivered"],
  ["RECEIPT_CONFIRMED", "Receipt confirmed"],
];
export const stageIndex = (status: OrderStatus) => STAGES.findIndex(([s]) => s === status);

/** Server UUIDs are long; show a recognisable prefix while the full ID stays in the data. */
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
export const temperatureLabel = (t: OrderResponse["temperature_requirement"]) =>
  t === "chilled" ? "Chilled" : "Dry / ambient";

const DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo",
});
/** Calendar dates (YYYY-MM-DD) are Colombo dates; format them without shifting the day. */
export const formatDate = (iso: string) => DATE.format(new Date(iso + "T00:00:00Z"));
export const formatTime = (iso: string) => TIME.format(new Date(iso)) + " (Colombo)";

/**
 * Display-only guess of the next accepted date (16:00 Colombo cutoff). The server applies
 * the cutoff authoritatively and returns the accepted date.
 */
export function suggestedDeliveryDate(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const today = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  const days = +parts.hour >= 16 ? 2 : 1;
  return new Date(today + days * 86_400_000).toISOString().slice(0, 10);
}

export function listOrders(params: { status?: OrderStatus; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("limit", String(params.limit ?? 20));
  query.set("offset", String(params.offset ?? 0));
  return backend.request<OrderListResponse>("/store/orders?" + query.toString());
}

/** Totals per status from the server (one small request per status). */
export async function countByStatus(): Promise<Record<OrderStatus, number>> {
  const totals = await Promise.all(STATUSES.map((status) => listOrders({ status, limit: 1 })));
  return Object.fromEntries(STATUSES.map((status, i) => [status, totals[i].total])) as Record<OrderStatus, number>;
}

export const getOrder = (id: string) => backend.request<OrderResponse>("/store/orders/" + encodeURIComponent(id));

export const createOrder = (body: OrderCreateRequest) =>
  backend.request<OrderCreateResponse>("/store/orders", { method: "POST", body: JSON.stringify(body) });

export const getReceipt = (orderId: string) =>
  backend.request<ReceiptResponse>("/store/orders/" + encodeURIComponent(orderId) + "/receipt");

export const confirmReceipt = (orderId: string, requestId: string) =>
  backend.request<ReceiptResponse>("/store/orders/" + encodeURIComponent(orderId) + "/receipt", {
    method: "POST",
    body: JSON.stringify({ request_id: requestId }),
  });

/** Quantities: up to 3 decimals, positive, below 1,000,000,000 (as the API validates). */
export const QUANTITY = /^\d{1,9}(\.\d{1,3})?$/;
export const validQuantity = (value: string) => QUANTITY.test(value.trim()) && Number(value) > 0;
