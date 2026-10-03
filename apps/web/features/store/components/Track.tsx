"use client";
import { Alert, Kv, Badge } from "./ui";
import { STAGES } from "../data/mock";
import type { Order, GoFn, PatchFn } from "../data/mock";

export default function Track({ o, go, patch }: { o: Order; go: GoFn; patch: PatchFn }) {
  const s = o.stage;
  const xs = [15, 55, 100, 145, 190, 235, 280], ys = [70, 50, 60, 30, 45, 20, 35];
  return (<>
    <button onClick={() => go("orders")}>‹ Orders</button>
    <h1 style={{ marginTop: 10 }}>{o.id} <Badge o={o} /></h1><p className="sub">{o.ty} · OUT017</p>
    {o.st === "Deferred" ? (<>
      <Alert k="w" t="Delivery moved">Original: Tuesday 29 September → Revised: <b style={{ display: "inline" }}>Wednesday 30 September</b>.</Alert>
      <button className="p" onClick={() => go("orders")}>Understood</button>
    </>) : (<>
      {s <= 1 && <Alert t="ETA pending — Awaiting plan">The ETA will appear after tonight's plan is published.</Alert>}
      {o.late && <Alert k="w" t="Late risk">Expected arrival 06:24 may be after the 07:00 window end (06:00–07:00).</Alert>}
      {o.delay && <Alert k="w" t="Driver update delayed">Last update: 06:12. Information may be delayed; deliveries can continue.</Alert>}
      {s === 4 && !o.late && !o.delay && <Alert t="Expected arrival: 06:24">Window 06:00–07:00</Alert>}
      <div className="g g2">
        <div className="card"><h2>{s >= 5 ? "Handover record" : "Delivery route"}</h2>
          {s >= 5 ? (<><Kv a="Delivered at" b="06:31" /><Kv a="Received by" b="Nimal" /><Kv a="Lines" b={`${o.lines ? o.lines.length : 10} lines`} />{o.st === "Needs action" && <Kv a="Issue" b="1 short item" />}</>) : (<>
            <svg viewBox="0 0 300 90" width="100%" role="img" aria-label="Stop 3 of 7">
              <polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(" ")} fill="none" stroke="var(--pr)" strokeWidth="3" />
              {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={i === 2 ? 8 : 5} fill={i === 2 ? "#f59e0b" : "var(--card)"} stroke="var(--pr)" strokeWidth="2" />)}
            </svg>
            <Kv a="Vehicle" b={s <= 1 ? "Pending assignment" : "VEH018 Refrigerated"} />
            {s >= 4 && <><Kv a="Route" b="Stop 3 of 7" /><Kv a="Last update" b={o.delay ? "06:12" : "06:05"} /></>}
          </>)}
        </div>
        <div className="card"><h2>Order progress</h2>
          <ul className="tl">{STAGES.map((x, i) => <li key={x} className={i < s ? "ok" : ""}>{x}</li>)}</ul>
          {o.st === "Needs action" && <button className="p" style={{ width: "100%" }} onClick={() => go("receipt", o.id)}>Confirm receipt</button>}
          {s === 4 && <div className="row" style={{ marginTop: 10 }}>
            <button onClick={() => patch(o.id, { late: true, delay: false })}>Show late risk</button>
            <button onClick={() => patch(o.id, { late: false, delay: true })}>Show delayed update</button></div>}
        </div>
      </div>
    </>)}
  </>);
}
