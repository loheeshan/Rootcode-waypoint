"use client";
import { useState } from "react";
import { Kv, Modal } from "./ui";
import { DEF } from "../data/mock";
import type { Order, State, SetFn, PatchFn, Cur } from "../data/mock";

export default function IssueModal({ S, set, patch, order }: { S: State; set: SetFn; patch: PatchFn; order: Order }) {
  const l = S.cur as Cur;
  const [type, setType] = useState("Missing");
  const [note, setNote] = useState(`${l.o - l.r} ${l.n.split(" ")[1] || "units"} were missing from the delivery`);
  const [review, setReview] = useState(false);
  const close = () => set({ modal: null });
  const save = () => {
    patch(order.id, (o) => ({
      lines: (o.lines || DEF).map((x, j) => (j === l.i ? { ...x, m: { p: l.n, o: l.o, r: l.r, type, n: note } } : x)),
    }));
    close();
  };
  return (
    <Modal onClose={close}>
      {!review ? (<>
        <h2>Report an issue</h2><p className="m">{l.n}: ordered {l.o}, driver recorded {l.r}</p>
        <label>Issue type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {["Missing", "Damaged", "Quantity mismatch", "Wrong item", "Temperature problem"].map((x) => <option key={x}>{x}</option>)}
          </select></label><br /><br />
        <label>Receiving note<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="row" style={{ marginTop: 8 }}><button onClick={() => set({ photo: !S.photo })}>{S.photo ? "Photo attached ✓" : "Attach photo"}</button></div>
        <div className="row" style={{ marginTop: 12 }}><button className="p" onClick={() => setReview(true)}>Review issue</button><button onClick={close}>Cancel</button></div>
      </>) : (<>
        <h2>Review your discrepancy</h2>
        <Kv a="Product" b={l.n} /><Kv a="Ordered" b={l.o} /><Kv a="Received" b={l.r} /><Kv a="Issue" b={type} /><Kv a="Note" b={note} />
        <Kv a="Evidence" b={S.photo ? "Photo attached" : "None"} />
        <div className="row" style={{ marginTop: 12 }}><button className="p" onClick={save}>Save issue</button><button onClick={() => setReview(false)}>Back</button></div>
      </>)}
    </Modal>
  );
}
