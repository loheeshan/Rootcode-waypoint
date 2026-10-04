"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError, errorMessage, type ReceiptResponse } from "@waypoint/api-contracts";
import { Alert, Kv, LoadError, Loading, useLoad } from "./ui";
import { confirmReceipt, formatDate, formatTime, getOrder, getReceipt, shortId, temperatureLabel } from "../data/store";
import type { GoFn } from "../data/store";

// One request ID per order for this page session: retries and double clicks reuse it, so the
// server records at most one receipt and replays the saved result.
const requestIds = new Map<string, string>();
const requestIdFor = (orderId: string) => {
  if (!requestIds.has(orderId)) requestIds.set(orderId, crypto.randomUUID());
  return requestIds.get(orderId)!;
};

export default function Receipt({ id, go, onExpired }: { id: string; go: GoFn; onExpired: () => void }) {
  const order = useLoad(() => getOrder(id), onExpired, id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ReceiptResponse | null>(null);
  const sending = useRef(false);
  const alreadyConfirmed = order.data?.status === "RECEIPT_CONFIRMED";

  // Opening the page for an already confirmed order shows its saved receipt.
  useEffect(() => {
    if (!alreadyConfirmed) return;
    let active = true;
    getReceipt(id).then((receipt) => active && setSaved(receipt), () => undefined);
    return () => { active = false; };
  }, [alreadyConfirmed, id]);

  if (order.loading && !order.data) return <Loading t="Loading order…" />;
  if (order.error || !order.data) return <LoadError error={order.error} retry={order.reload} />;
  const o = order.data;

  const submit = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      setSaved(await confirmReceipt(o.id, requestIdFor(o.id)));
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return onExpired();
      if (failure instanceof ApiError && failure.status === 409) {
        // Already confirmed (e.g. a retry after a lost response): show the saved receipt.
        const existing = await getReceipt(o.id).catch(() => null);
        if (existing) return setSaved(existing);
      }
      setError(failure instanceof ApiError ? errorMessage(failure) : "Connection interrupted. Your confirmation was not sent; try again.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (saved) return (<>
    <h1>Receipt confirmed</h1>
    <Alert k="s" t="Receipt confirmed">Your confirmation is recorded separately from the driver&apos;s delivery record.</Alert>
    <div className="g" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="card"><h2>Store confirmation</h2><Kv a="Order" b={shortId(saved.order_id)} /><Kv a="Confirmed" b={formatTime(saved.confirmed_at)} /></div>
      <div className="card"><h2>Driver record</h2><Kv a="Delivered" b={formatTime(saved.delivered_at)} /></div>
    </div>
    <button className="p" onClick={() => go("order", o.id)}>View order</button> <button onClick={() => go("orders")}>Back to orders</button>
  </>);

  if (o.status !== "DELIVERED") return (<>
    <h1>Confirm receipt</h1>
    <Alert k="w" t="Receipt not available">
      Only orders the driver recorded as delivered can be confirmed. This order is currently: {o.status === "RECEIPT_CONFIRMED" ? "already confirmed" : o.status.replace(/_/g, " ").toLowerCase()}.
    </Alert>
    <button onClick={() => go("order", o.id)}>Back to order</button>
  </>);

  return (<>
    <h1>Confirm what arrived</h1>
    <p className="sub">{shortId(o.id)} · {temperatureLabel(o.temperature_requirement)} · Delivery {formatDate(o.requested_delivery_date)}</p>
    <Alert t="Confirm the whole delivery">Check the consignment ({o.order_weight_kg} kg, {o.order_volume_m3} m³) against what you received. Reporting shortages or damage is not available in the app yet; contact your dispatcher.</Alert>
    {error && <Alert k="e" t="Receipt not confirmed">{error}</Alert>}
    <div className="row">
      <button className="p" disabled={busy} onClick={submit}>{busy ? "Confirming…" : error ? "Retry" : "Confirm receipt"}</button>
      <button onClick={() => go("order", o.id)}>Back</button>
    </div>
  </>);
}
