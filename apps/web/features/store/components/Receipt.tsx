"use client";
import { Alert, Kv } from "./ui";
import { DEF } from "../data/mock";
import type { Order, State, SetFn, GoFn, PatchFn, Issue } from "../data/mock";

export default function Receipt({ o, S, set, go, patch, submit }: { o: Order; S: State; set: SetFn; go: GoFn; patch: PatchFn; submit: () => void }) {
  const lines = o.lines || DEF;
  const mark = (i: number, m: "ok" | Issue) => patch(o.id, { lines: lines.map((l, j) => (j === i ? { ...l, m } : l)) });
  if (o.done) return (<>
    <h1>Receipt confirmed</h1>
    <Alert k="s" t="Receipt confirmed">Your receipt is recorded separately from the driver's record. Reporting an issue does not overwrite the driver record or approve a credit.</Alert>
    <div className="g" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="card"><h2>Store confirmation</h2><Kv a="Confirmed by" b="Chamari" /><Kv a="Time" b={o.ct || "06:42"} /></div>
      <div className="card"><h2>Driver record</h2><Kv a="Received by" b="Nimal" /><Kv a="Time" b="06:31" /></div>
    </div>
    {(o.issues || []).map((i, k) => <Alert key={k} k="w" t={`Issue reported: ${i.type}`}>{i.p}: ordered {i.o}, driver recorded {i.r}. Note: {i.n || "—"}</Alert>)}
    <button className="p" onClick={() => go("orders")}>Back to orders</button>
  </>);
  const all = lines.every((l) => l.m);
  const hasIssue = lines.some((l) => l.m && l.m !== "ok");
  return (<>
    <h1>Confirm what arrived</h1><p className="sub">{o.id} · Delivered 06:31 by Nimal</p>
    <Alert t="Driver's record stays unchanged">Check each line against what you received.</Alert>
    {lines.map((l, i) => {
      const d = l.o - l.r;
      return (
        <div className="card row sp" key={l.n}>
          <div><b>{l.n}</b><div className="m">Ordered {l.o} · Driver recorded {l.r} · {d ? <b style={{ color: "var(--rd)" }}>{d} short</b> : "Match"}</div></div>
          <div className="row">
            {l.m === "ok" && <span className="b Confirmed">Correct</span>}
            {l.m && l.m !== "ok" && <span className="b Needs">Issue: {l.m.type}</span>}
            <button onClick={() => mark(i, "ok")}>Mark correct</button>
            <button onClick={() => set({ cur: { ...l, i }, photo: false, modal: "issue" })}>Report issue</button>
          </div>
        </div>
      );
    })}
    {S.err === "receipt" && <Alert k="e" t="Receipt not submitted">Connection interrupted. Your checks and notes are saved.</Alert>}
    <div className="row">
      <button className="p" disabled={!all} onClick={submit}>{S.err === "receipt" ? "Retry" : `Submit receipt${hasIssue ? " & issue" : ""}`}</button>
      <button onClick={() => go("order", o.id)}>Back</button>
    </div>
  </>);
}
