"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ApiError, errorMessage, signInMessages,
  type AuthUser, type OrderCreateResponse, type OrderResponse, type OrderStatus,
} from "@waypoint/api-contracts";
import AppShell from "./AppShell";
import Auth from "./Auth";
import Track from "./Track";
import Receipt from "./Receipt";
import { Alert, Empty, Kv, LoadError, Loading, Modal, OrderCard, useLoad } from "./ui";
import {
  IN_PROGRESS, STATUS_LABEL, STATUSES, countByStatus, createOrder, formatDate, listOrders,
  shortId, suggestedDeliveryDate, validQuantity,
} from "../data/store";
import type { GoFn } from "../data/store";
import { currentSession, webSignOut } from "@/lib/auth-client";

const PAGE = 20;
type Draft = { outlet: string; temperature: "ambient" | "chilled"; weight: string; volume: string; date: string };

export default function Waypoint() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [route, setRoute] = useState("home");
  const [id, setId] = useState<string | null>(null);
  const go: GoFn = useCallback((r, next = null) => { setRoute(r); setId(next); }, []);

  // The server session (httpOnly cookie) decides whether the user is signed in, also on reload.
  useEffect(() => {
    let active = true;
    currentSession("STORE_MANAGER").then((result) => {
      if (!active) return;
      if (result.status === "signed-in") setUser(result.user);
      else if (result.status === "expired") setExpired(true);
      else if (result.status !== "signed-out") setNotice(signInMessages[result.status]);
      setChecking(false);
    });
    return () => { active = false; };
  }, []);

  const onExpired = useCallback(() => { setUser(null); setExpired(true); }, []);
  const signOut = async () => {
    await webSignOut();
    setUser(null);
    setExpired(false);
    setNotice(null);
    go("home");
  };

  if (checking) return <div style={{ width: "100%" }}><div className="sig card"><p className="m">Checking your session…</p></div></div>;
  if (!user) {
    return <Auth expired={expired} notice={notice} onSignedIn={(signedIn) => {
      setUser(signedIn); setExpired(false); setNotice(null); go("home");
    }} />;
  }

  const outlets = user.outlet_ids;
  const context = outlets.length === 1 ? `Outlet ${shortId(outlets[0])}` : `${outlets.length} outlets`;
  let view: ReactNode;
  if (!outlets.length) view = <Empty t="No outlet assigned" d="Ask an administrator to assign your outlet before placing orders." />;
  else if (route === "home") view = <Home user={user} go={go} onExpired={onExpired} />;
  else if (route === "orders") view = <Orders go={go} onExpired={onExpired} />;
  else if (route === "new") view = <NewOrder outlets={outlets} go={go} onExpired={onExpired} />;
  else if (route === "order" && id) view = <Track key={id} id={id} go={go} onExpired={onExpired} />;
  else if (route === "receipt" && id) view = <Receipt key={id} id={id} go={go} onExpired={onExpired} />;
  else if (route === "deliv") view = <StatusGroups title="Deliveries" statuses={["PLANNED", "LOADING", "OUT_FOR_DELIVERY"]} go={go} onExpired={onExpired} empty="No deliveries are planned or on the way." />;
  else if (route === "receipts") view = <StatusGroups title="Receipts" statuses={["DELIVERED", "RECEIPT_CONFIRMED"]} go={go} onExpired={onExpired} empty="No delivered orders yet." />;
  else if (route === "notif") view = <><h1>Notifications</h1><Empty t="Notifications are not available yet" d="Check order status on the Orders page." btn="My orders" onClick={() => go("orders")} /></>;
  else if (route === "support") view = <><h1>Support</h1><div className="card"><h2>Central logistics desk</h2><p className="m">For delivery questions, deferrals or receipt problems, contact your dispatcher.</p></div></>;
  else if (route === "settings") {
    view = (<><h1>Settings</h1>
      <div className="card"><h2>My profile</h2><Kv a="Email" b={user.email} /><Kv a="Role" b="Store Manager" />
        <Kv a="Outlets" b={outlets.map(shortId).join(", ")} /></div>
      <button className="d" onClick={signOut}>Sign out</button></>);
  } else if (route === "daily") {
    view = (<><h1>Daily replenishment</h1><p className="sub">Order before 16:00 Colombo time for next-day delivery.</p>
      <div className="card">Dry / ambient and chilled consignments are separate orders, each with its own weight and volume.<br /><br /><button className="p" onClick={() => go("new")}>Start an order</button></div></>);
  } else view = <Empty t="Not found" d="" btn="Home" onClick={() => go("home")} />;

  return <AppShell route={route} go={go} context={context} email={user.email}>{view}</AppShell>;
}

type ViewProps = { go: GoFn; onExpired: () => void };

function Home({ user, go, onExpired }: ViewProps & { user: AuthUser }) {
  const counts = useLoad(countByStatus, onExpired);
  const recent = useLoad(() => listOrders({ limit: PAGE }), onExpired);
  const sum = (statuses: OrderStatus[]) => statuses.reduce((n, s) => n + (counts.data?.[s] ?? 0), 0);
  const tiles: [string, OrderStatus[]][] = [
    ["In progress", IN_PROGRESS], ["Needs receipt", ["DELIVERED"]], ["Deferred", ["DEFERRED"]], ["Receipt confirmed", ["RECEIPT_CONFIRMED"]],
  ];
  const open = (recent.data?.items ?? []).filter((o) => o.status !== "RECEIPT_CONFIRMED");
  return (<>
    <h1>Hello</h1><p className="sub">{user.email}</p>
    <Alert t="Cutoff 16:00 · Asia/Colombo">Orders placed before 16:00 can be delivered the next day; later orders move to the following day.</Alert>
    {counts.error ? <LoadError error={counts.error} retry={counts.reload} /> : (
      <div className="g g4">{tiles.map(([label, statuses]) => (
        <div className="card" key={label}><div className="m">{label}</div><h1>{counts.loading ? "…" : sum(statuses)}</h1></div>
      ))}</div>
    )}
    <div className="row"><button className="p" onClick={() => go("new")}>New order</button><button onClick={() => go("orders")}>My orders</button></div>
    <h2 style={{ marginTop: 18 }}>Receiving plan</h2>
    {recent.loading ? <Loading /> : recent.error ? <LoadError error={recent.error} retry={recent.reload} />
      : open.length ? open.map((o) => <OrderCard key={o.id} o={o} go={go} />)
        : <Empty t="Nothing to receive" d="Orders you place will appear here." btn="Create an order" onClick={() => go("new")} />}
  </>);
}

function Orders({ go, onExpired }: ViewProps) {
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const list = useLoad(
    () => listOrders({ status: status === "ALL" ? undefined : status, limit: PAGE, offset: page * PAGE }),
    onExpired, `${status}:${page}`,
  );
  const q = search.trim().toLowerCase();
  const items = (list.data?.items ?? []).filter((o) => !q || o.id.toLowerCase().startsWith(q));
  const total = list.data?.total ?? 0;
  return (<>
    <h1>My orders</h1><p className="sub">Newest first · search this page by order ID</p>
    <div className="row" style={{ marginBottom: 14 }}>
      <div style={{ flex: 1 }}><input type="text" aria-label="Search by order ID" placeholder="Order ID, e.g. 3F2A9C1D" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <button onClick={list.reload} disabled={list.loading}>Refresh</button>
    </div>
    <div className="tab">{(["ALL", ...STATUSES] as const).map((s) => (
      <button key={s} className={status === s ? "on" : ""} onClick={() => { setStatus(s); setPage(0); }}>{s === "ALL" ? "All" : STATUS_LABEL[s]}</button>
    ))}</div>
    {list.loading ? <Loading t="Loading orders…" /> : list.error ? <LoadError error={list.error} retry={list.reload} />
      : items.length ? items.map((o) => <OrderCard key={o.id} o={o} go={go} />)
        : total ? <Empty t="No results on this page" d="Try a different order ID or clear the search." btn="Clear search" onClick={() => setSearch("")} />
          : status === "ALL" ? <Empty t="No orders yet" d="" btn="Create your first order" onClick={() => go("new")} />
            : <Empty t={`No ${STATUS_LABEL[status].toLowerCase()} orders`} d="" btn="Show all" onClick={() => setStatus("ALL")} />}
    {total > PAGE && (
      <div className="row" style={{ marginTop: 12 }}>
        <button disabled={page === 0 || list.loading} onClick={() => setPage((p) => p - 1)}>‹ Newer</button>
        <span className="m">Page {page + 1} of {Math.ceil(total / PAGE)}</span>
        <button disabled={(page + 1) * PAGE >= total || list.loading} onClick={() => setPage((p) => p + 1)}>Older ›</button>
      </div>
    )}
  </>);
}

function StatusGroups({ title, statuses, go, onExpired, empty }: ViewProps & { title: string; statuses: OrderStatus[]; empty: string }) {
  const lists = useLoad(() => Promise.all(statuses.map((status) => listOrders({ status, limit: 50 }))), onExpired, statuses.join());
  if (lists.loading) return <><h1>{title}</h1><Loading /></>;
  if (lists.error || !lists.data) return <><h1>{title}</h1><LoadError error={lists.error} retry={lists.reload} /></>;
  const groups = lists.data;
  return (<><h1>{title}</h1>
    {groups.every((g) => !g.items.length) ? <Empty t="Nothing here" d={empty} /> : statuses.map((status, i) => groups[i].items.length ? (
      <div key={status}><h2 style={{ marginTop: 14 }}>{STATUS_LABEL[status]} ({groups[i].total})</h2>
        {groups[i].items.map((o: OrderResponse) => <OrderCard key={o.id} o={o} go={go} />)}</div>
    ) : null)}
  </>);
}

function NewOrder({ outlets, go, onExpired }: ViewProps & { outlets: string[] }) {
  const [draft, setDraft] = useState<Draft>({ outlet: outlets[0], temperature: "ambient", weight: "", volume: "", date: suggestedDeliveryDate() });
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<OrderCreateResponse | null>(null);
  // Synchronous lock: creation is not idempotent, so a second click must never send again.
  const sending = useRef(false);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const valid = validQuantity(draft.weight) && validQuantity(draft.volume) && !!draft.date;

  const submit = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      setSaved(await createOrder({
        outlet_id: draft.outlet, requested_delivery_date: draft.date, temperature_requirement: draft.temperature,
        order_weight_kg: draft.weight.trim(), order_volume_m3: draft.volume.trim(),
      }));
      setReview(false);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return onExpired();
      // Order creation is not idempotent: after an uncertain failure, check the list first.
      setError(failure instanceof ApiError
        ? errorMessage(failure, "The order was not accepted.")
        : "Connection interrupted. The order may not have been saved; check My orders before submitting again.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (saved) {
    const o = saved.order;
    return (<>
      <Alert k="s" t="Order received">The server accepted your order.</Alert>
      {saved.cutoff_applied && <Alert k="w" t="Cutoff applied">Requested for {formatDate(saved.submitted_delivery_date)}; after the 16:00 cutoff it moved to {formatDate(o.requested_delivery_date)}.</Alert>}
      <div className="card"><h2>Order {shortId(o.id)}</h2>
        <Kv a="Status" b={STATUS_LABEL[o.status]} /><Kv a="Temperature" b={o.temperature_requirement === "chilled" ? "Chilled" : "Dry / ambient"} />
        <Kv a="Weight" b={`${o.order_weight_kg} kg`} /><Kv a="Volume" b={`${o.order_volume_m3} m³`} /><Kv a="Delivery date" b={formatDate(o.requested_delivery_date)} /></div>
      <Alert t="Planning still to come">Acceptance does not guarantee vehicle capacity; the dispatcher plans deliveries.</Alert>
      <button className="p" onClick={() => go("order", o.id)}>Track order</button> <button onClick={() => { setSaved(null); update({ weight: "", volume: "" }); }}>New order</button>
    </>);
  }

  const form = (e: FormEvent) => { e.preventDefault(); if (valid) { setError(null); setReview(true); } };
  return (<>
    <h1>New order</h1><p className="sub">One consignment per temperature type</p>
    <Alert t="Cutoff 16:00 · Asia/Colombo">The server applies the cutoff and confirms the accepted delivery date.</Alert>
    <div className="tab">{([["ambient", "Dry / ambient"], ["chilled", "Chilled"]] as const).map(([k, l]) => (
      <button key={k} className={draft.temperature === k ? "on" : ""} onClick={() => update({ temperature: k })}>{l}</button>
    ))}</div>
    <form className="card" onSubmit={form}>
      <h2>Consignment</h2>
      {outlets.length > 1 && <label>Outlet<select value={draft.outlet} onChange={(e) => update({ outlet: e.target.value })}>
        {outlets.map((o) => <option key={o} value={o}>{shortId(o)}</option>)}</select></label>}
      <label>Total weight (kg)<input type="text" inputMode="decimal" required placeholder="e.g. 125.5" value={draft.weight} onChange={(e) => update({ weight: e.target.value })} aria-invalid={!!draft.weight && !validQuantity(draft.weight)} /></label><br /><br />
      <label>Total volume (m³)<input type="text" inputMode="decimal" required placeholder="e.g. 0.875" value={draft.volume} onChange={(e) => update({ volume: e.target.value })} aria-invalid={!!draft.volume && !validQuantity(draft.volume)} /></label><br /><br />
      <label>Requested delivery date<input type="date" required value={draft.date} onChange={(e) => update({ date: e.target.value })} /></label>
      {(draft.weight && !validQuantity(draft.weight)) || (draft.volume && !validQuantity(draft.volume))
        ? <Alert k="e" t="Check the quantities">Use a positive number with up to 3 decimal places.</Alert> : null}
      {error && !review && <Alert k="e" t="Order not submitted">{error}</Alert>}
      <button className="p" type="submit" style={{ width: "100%", marginTop: 10 }} disabled={!valid}>Review order</button>
    </form>
    {review && (
      <Modal onClose={() => setReview(false)}>
        <h2>Review your order</h2>
        <Kv a="Outlet" b={shortId(draft.outlet)} /><Kv a="Temperature" b={draft.temperature === "chilled" ? "Chilled" : "Dry / ambient"} />
        <Kv a="Weight" b={`${draft.weight} kg`} /><Kv a="Volume" b={`${draft.volume} m³`} /><Kv a="Requested date" b={formatDate(draft.date)} />
        {error && <Alert k="e" t="Order not submitted">{error}</Alert>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="p" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit order"}</button>
          <button onClick={() => setReview(false)} disabled={busy}>Back to edit</button>
        </div>
      </Modal>
    )}
  </>);
}
