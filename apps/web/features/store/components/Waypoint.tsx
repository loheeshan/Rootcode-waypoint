"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import AppShell from "./AppShell";
import Auth from "./Auth";
import Track from "./Track";
import Receipt from "./Receipt";
import IssueModal from "./IssueModal";
import { Alert, Kv, Empty, OrderCard, Modal } from "./ui";
import { P, DEF, init, totals, lineList } from "../data/mock";
import type { State, SetFn, GoFn, PatchFn, Issue } from "../data/mock";

export default function Waypoint() {
  const [S, setS] = useState<State>(init);
  const set: SetFn = (p) => setS((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) }));
  const go: GoFn = (route, id = null) => set({ route, id, modal: null, err: null });
  const patch: PatchFn = (id, f) => set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...(typeof f === "function" ? f(o) : f) } : o)) }));
  const date = S.late ? "Wednesday 30 September" : "Tuesday 29 September";
  const clock = S.late ? "16:20" : "15:42";
  const t = totals(S.q);
  const order = S.orders.find((o) => o.id === S.id);

  if (!S.signed) return <Auth S={S} set={set} />;

  const setQ = (k: string, n: number) => set((s) => ({ qerr: n > 99, q: { ...s.q, [k]: Math.min(99, Math.max(0, n)) } }));

  const submitOrder = () => {
    if (S.off || S.fail) return set({ fail: false, err: "order" });
    const ls = lineList(S.q);
    const ids: string[][] = [];
    if (ls.some((l) => l[0] === "dry")) ids.push(["ORD0092316", "Dry"]);
    if (ls.some((l) => l[0] === "chilled")) ids.push(["ORD0092317", "Chilled"]);
    set((s) => ({
      orders: [...ids.map((i) => ({ id: i[0], st: "Active", ty: "Fresh · " + (i[1] === "Dry" ? "Dry / ambient" : "Chilled"), info: "Confirmed · ETA pending", stage: 1 })), ...s.orders],
      sent: { ids, t, d: date }, q: {}, err: null, modal: null, route: "received",
    }));
  };

  const submitReceipt = () => {
    if (!order) return;
    if (S.off || S.fail) return set({ fail: false, err: "receipt" });
    const lines = order.lines || DEF;
    const issues = lines.filter((l) => l.m && l.m !== "ok").map((l) => l.m as Issue);
    patch(order.id, { issues, done: true, ct: "06:42", stage: 6, st: "Delivered", info: issues.length ? "Receipt confirmed · issue reported" : "Receipt confirmed" });
    set((s) => ({ err: null, notes: s.notes.map((n) => (n.o === order.id ? { ...n, u: 0 } : n)) }));
  };

  const banner = S.late
    ? <Alert k="w" t="The cutoff has passed">Orders placed now are scheduled for the next applicable delivery date, Wednesday. You must accept it before submitting.</Alert>
    : <Alert t="Cutoff 16:00 · Asia/Colombo">Order before 16:00 for delivery on Tuesday 29 September.</Alert>;

  const unread = S.notes.filter((n) => n.u).length;

  /* ----- views ----- */
  let view: ReactNode;
  const r = S.route;
  if (r === "home") {
    const c = (st: string) => S.orders.filter((o) => o.st === st).length;
    view = (<>
      <h1>Hello, Chamari</h1><p className="sub">OUT017 · Fresh · Colombo 03</p>{banner}
      <div className="g g4">{["Active", "Needs action", "Deferred", "Delivered"].map((x) => <div className="card" key={x}><div className="m">{x}</div><h1>{c(x)}</h1></div>)}</div>
      <div className="row"><button className="p" onClick={() => go("new")}>New order</button><button onClick={() => go("orders")}>My orders</button></div>
      <h2 style={{ marginTop: 18 }}>Receiving plan</h2>
      {S.orders.filter((o) => o.st !== "Delivered").map((o) => <OrderCard key={o.id} o={o} go={go} />)}
    </>);
  } else if (r === "orders" || r === "history") {
    const q = S.search.toLowerCase();
    let L = S.orders;
    if (r === "orders" && S.filter !== "All") L = L.filter((o) => o.st === S.filter);
    if (q) L = L.filter((o) => {
      const prods = o.ty.includes("Dry") ? "basmati rice sunflower oil salt" : "highland milk anchor butter curd";
      return o.id.toLowerCase().includes(q) || prods.includes(q);
    });
    view = S.loadFail ? (
      <div className="es"><h2>We couldn't load orders</h2><p className="m">Your existing orders remain safe.</p>
        <div className="row" style={{ justifyContent: "center" }}><button className="p" onClick={() => set({ loadFail: false })}>Try again</button><button onClick={() => go("support")}>Contact support</button></div></div>
    ) : (<>
      <h1>{r === "orders" ? "My orders" : "Order history"}</h1><p className="sub">Search by order ID or product</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <div style={{ flex: 1 }}><input type="text" aria-label="Search" placeholder="Search ORD0092314 or Basmati rice" value={S.search} onChange={(e) => set({ search: e.target.value })} /></div>
        <button onClick={() => go(r === "orders" ? "history" : "orders")}>{r === "orders" ? "History" : "Active orders"}</button>
      </div>
      {r === "orders" && <div className="tab">{["All", "Active", "Needs action", "Deferred", "Delivered"].map((f) => <button key={f} className={S.filter === f ? "on" : ""} onClick={() => set({ filter: f })}>{f}</button>)}</div>}
      {L.length ? L.map((o) => <OrderCard key={o.id} o={o} go={go} />)
        : S.orders.length ? <Empty t="No results found" d="Try a different order ID or product." btn="Clear search" onClick={() => set({ search: "", filter: "All" })} />
        : <Empty t="No orders yet" d="" btn="Create your first order" onClick={() => go("new")} />}
    </>);
  } else if (r === "new") {
    view = (<>
      <h1>New order</h1><p className="sub">OUT017 · Fresh · Colombo 03</p>{banner}
      <div className="tab">{[["dry", "Dry / ambient"], ["chilled", "Chilled"]].map(([k, l]) => <button key={k} className={S.stream === k ? "on" : ""} onClick={() => set({ stream: k })}>{l}</button>)}</div>
      <div className="g g2">
        <div className="card"><h2>Products</h2>
          {P[S.stream].map((p) => (
            <div className="pr" key={p[0]}>
              <div><b>{p[1]}</b><div className="m">SKU {p[0]} · {p[2]} kg · {p[3]} m³ per unit</div></div>
              <div className="q">
                <button aria-label="Decrease" onClick={() => setQ(p[0], (S.q[p[0]] || 0) - 1)}>−</button>
                <input type="text" inputMode="numeric" aria-label={`Quantity ${p[1]}`} value={S.q[p[0]] || 0}
                  onChange={(e) => /^\d*$/.test(e.target.value) && setQ(p[0], +e.target.value)} />
                <button aria-label="Increase" onClick={() => setQ(p[0], (S.q[p[0]] || 0) + 1)}>+</button>
              </div>
            </div>
          ))}
          {S.qerr && <Alert k="e" t="Quantity limit reached">Maximum 99 units per line.</Alert>}
        </div>
        <div className="card"><h2>Order summary</h2>
          <Kv a="Total units" b={t.u} /><Kv a="Total weight" b={`${t.w} kg`} /><Kv a="Total volume" b={`${t.v} m³`} /><Kv a="Delivery" b={date} />
          <button className="p" style={{ width: "100%", marginTop: 10 }} onClick={() => set({ err: null, modal: t.u ? "review" : "empty" })}>Review order</button>
        </div>
      </div>
      <button className="d" onClick={() => set({ q: {} })}>Clear order</button>
    </>);
  } else if (r === "received" && S.sent) {
    const x = S.sent;
    view = (<>
      <Alert k="s" t="Order received">Your delivery request has been received.</Alert>
      <div className="card"><h2>Fresh order request</h2>{x.ids.map((i) => <Kv key={i[0]} a={i[0]} b={i[1]} />)}
        <Kv a="Units" b={x.t.u} /><Kv a="Weight" b={`${x.t.w} kg`} /><Kv a="Volume" b={`${x.t.v} m³`} /><Kv a="Delivery" b={x.d} /></div>
      <Alert t="ETA depends on the route plan">Confirmation does not guarantee vehicle capacity, priority or final route assignment.</Alert>
      <button className="p" onClick={() => go("orders")}>Track orders</button> <button onClick={() => go("new")}>New order</button>
    </>);
  } else if (r === "order" && order) {
    view = <Track o={order} go={go} patch={patch} />;
  } else if (r === "receipt" && order) {
    view = <Receipt o={order} S={S} set={set} go={go} patch={patch} submit={submitReceipt} />;
  } else if (r === "deliv" || r === "receipts") {
    view = (<><h1>{r === "deliv" ? "Deliveries" : "Receipts"}</h1>
      {S.orders.filter((o) => (r === "deliv" ? o.st !== "Delivered" : o.stage >= 5)).map((o) => <OrderCard key={o.id} o={o} go={go} />)}</>);
  } else if (r === "notif") {
    view = (<><h1>Notifications</h1><p className="sub">Updates for OUT017 · Fresh</p>
      {S.notes.map((n, i) => (
        <div className={`card ${n.u ? "un" : ""}`} key={i}><div className="row sp">
          <div><b>{n.t}</b><div className="m">{n.d}</div></div>
          <div className="row">
            {n.o && <button onClick={() => { set((s) => ({ notes: s.notes.map((x, j) => (j === i ? { ...x, u: 0 } : x)) })); go("order", n.o); }}>Open</button>}
            {n.u ? <button onClick={() => set((s) => ({ notes: s.notes.map((x, j) => (j === i ? { ...x, u: 0 } : x)) }))}>Mark read</button> : null}
          </div></div></div>
      ))}</>);
  } else if (r === "support") {
    view = (<><h1>Support</h1><div className="card"><h2>Central logistics desk</h2><Kv a="Extension" b="402" /><Kv a="Outlet" b="OUT017 · Colombo 03" /></div></>);
  } else if (r === "settings") {
    view = (<><h1>Settings</h1>
      <div className="card"><h2>My profile</h2><Kv a="Name" b="Chamari" /><Kv a="Outlet" b="OUT017 · Fresh · Colombo 03" /></div>
      <div className="card"><h2>Notifications</h2>{["Delivery ETA updates", "Delivery moved", "Receipt reminders"].map((x) => <label className="kv" key={x}><span>{x}</span><input type="checkbox" defaultChecked /></label>)}</div>
      <button className="d" onClick={() => set({ signed: false, expired: false })}>Sign out</button></>);
  } else if (r === "daily") {
    view = (<><h1>Daily replenishment</h1><p className="sub">Fresh outlet · order before 16:00 each day.</p>
      <div className="card">Dry / ambient and Chilled are placed through one flow and handled as separate logistics orders.<br /><br /><button className="p" onClick={() => go("new")}>Start today's order</button></div></>);
  } else view = <Empty t="Not found" d="" btn="Home" onClick={() => go("home")} />;

  /* ----- modals ----- */
  let modal: ReactNode = null;
  if (S.modal === "empty") modal = (<Modal onClose={() => set({ modal: null })}><h2>Add at least one item</h2><p>An empty order can't be submitted. Enter a quantity for at least one product.</p><button className="p" onClick={() => set({ modal: null })}>OK</button></Modal>);
  if (S.modal === "review") modal = (
    <Modal onClose={() => set({ modal: null })}>
      <h2>Review your order</h2>
      <Alert k={S.late ? "w" : "i"} t={`Cutoff checked: ${clock}`}>{S.late ? "After 16:00 — new date must be accepted." : "Before 16:00"}</Alert>
      <Kv a="Outlet" b="OUT017 · Fresh" />
      <Kv a="Streams" b={[...new Set(lineList(S.q).map((l) => (l[0] === "dry" ? "Dry / ambient" : "Chilled")))].join(" + ")} />
      {lineList(S.q).map((l) => <Kv key={l[1][0]} a={l[1][1]} b={`× ${l[2]}`} />)}
      <Kv a="Delivery" b={date} /><Kv a="Units / weight / volume" b={`${t.u} · ${t.w} kg · ${t.v} m³`} />
      {S.err === "order" && <Alert k="e" t="Order not submitted">Connection interrupted. Your draft is saved.</Alert>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="p" onClick={submitOrder}>{S.err === "order" ? "Retry" : S.late ? "Accept date & submit" : "Submit order"}</button>
        <button onClick={() => set({ modal: null })}>Back to edit</button>
      </div>
    </Modal>
  );
  if (S.modal === "issue" && order && S.cur) modal = <IssueModal S={S} set={set} patch={patch} order={order} />;

  return (
    <AppShell route={r} go={go} S={S} set={set} unread={unread}>
      {view}
      {modal}
    </AppShell>
  );
}
