"use client";
import type { ReceiptResponse } from "@waypoint/api-contracts";
import { Alert, Badge, Kv, LoadError, Loading, useLoad } from "./ui";
import {
  STAGES, formatDate, formatTime, getOrder, getReceipt, shortId, stageIndex, temperatureLabel,
} from "../data/store";
import type { GoFn } from "../data/store";

export default function Track({ id, go, onExpired }: { id: string; go: GoFn; onExpired: () => void }) {
  const order = useLoad(() => getOrder(id), onExpired, id);
  const confirmed = order.data?.status === "RECEIPT_CONFIRMED";
  const receipt = useLoad<ReceiptResponse | null>(
    () => (confirmed ? getReceipt(id) : Promise.resolve(null)), onExpired, `${id}:${confirmed}`,
  );

  if (order.loading && !order.data) return <Loading t="Loading order…" />;
  if (order.error || !order.data) return <><button onClick={() => go("orders")}>‹ Orders</button><LoadError error={order.error} retry={order.reload} /></>;
  const o = order.data;
  const stage = stageIndex(o.status);

  return (<>
    <button onClick={() => go("orders")}>‹ Orders</button>
    <h1 style={{ marginTop: 10 }}>{shortId(o.id)} <Badge status={o.status} /></h1>
    <p className="sub">{temperatureLabel(o.temperature_requirement)} · Delivery {formatDate(o.requested_delivery_date)}</p>
    {o.status === "DEFERRED" && (
      <Alert k="w" t="Delivery deferred">
        The dispatcher could not include this order in the plan for {formatDate(o.requested_delivery_date)}.
        The reason and any new date are not yet available in the Store app; contact your dispatcher.
      </Alert>
    )}
    {o.status === "CONFIRMED" && <Alert t="Awaiting the delivery plan">Accepted orders are planned by the dispatcher; acceptance does not guarantee vehicle capacity.</Alert>}
    <div className="g g2">
      <div className="card"><h2>Order</h2>
        <Kv a="Order ID" b={<span title={o.id}>{shortId(o.id)}</span>} />
        <Kv a="Temperature" b={temperatureLabel(o.temperature_requirement)} />
        <Kv a="Weight" b={`${o.order_weight_kg} kg`} />
        <Kv a="Volume" b={`${o.order_volume_m3} m³`} />
        <Kv a="Delivery date" b={formatDate(o.requested_delivery_date)} />
        <Kv a="Created" b={formatTime(o.created_at)} />
        {receipt.data && (<>
          <Kv a="Delivered" b={formatTime(receipt.data.delivered_at)} />
          <Kv a="Receipt confirmed" b={formatTime(receipt.data.confirmed_at)} />
        </>)}
        {confirmed && receipt.error ? <LoadError error={receipt.error} retry={receipt.reload} /> : null}
      </div>
      <div className="card"><h2>Order progress</h2>
        {o.status === "DEFERRED"
          ? <p className="m">Deferred before planning; no delivery is scheduled.</p>
          : <ul className="tl">{STAGES.map(([status, label], i) => <li key={status} className={i <= stage ? "ok" : ""}>{label}</li>)}</ul>}
        {o.status === "DELIVERED" && <button className="p" style={{ width: "100%" }} onClick={() => go("receipt", o.id)}>Confirm receipt</button>}
        <button style={{ marginTop: 10 }} onClick={order.reload} disabled={order.loading}>{order.loading ? "Refreshing…" : "Refresh status"}</button>
      </div>
    </div>
  </>);
}
