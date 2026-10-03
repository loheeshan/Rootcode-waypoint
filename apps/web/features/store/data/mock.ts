/**
 * Store Manager mock data + pure helpers (prototype only — no backend).
 * Shapes mirror the planned Store API (GET/POST /store/orders, GET /store/orders/{id},
 * POST /store/orders/{id}/receipt). To go live, replace `init` with data fetched via
 * `api` from apps/web/lib/api.ts and keep these types as the view-model layer.
 * Driver delivery records and store receipt confirmations are kept as SEPARATE records.
 */
export type Prod = [string, string, number, number];
export type Qty = Record<string, number>;
export type Issue = { p: string; o: number; r: number; type: string; n: string };
export type Line = { n: string; o: number; r: number; m?: "ok" | Issue };
export type Order = { id: string; st: string; ty: string; info: string; stage: number; lines?: Line[]; done?: boolean; late?: boolean; delay?: boolean; issues?: Issue[]; ct?: string };
export type Note = { t: string; d: string; u: number; o?: string };
export type Cur = Line & { i: number };
export type Sent = { ids: string[][]; t: { u: number; w: number; v: number }; d: string };
export type State = {
  signed: boolean; route: string; id: string | null; stream: string; q: Qty; late: boolean; off: boolean; fail: boolean;
  loadFail: boolean; expired: boolean; modal: string | null; search: string; filter: string; err: string | null;
  sent: Sent | null; qerr: boolean; photo: boolean; cur: Cur | null; orders: Order[]; notes: Note[];
};
export type SetFn = (p: Partial<State> | ((s: State) => Partial<State>)) => void;
export type GoFn = (route: string, id?: string | null) => void;
export type PatchFn = (id: string, f: Partial<Order> | ((o: Order) => Partial<Order>)) => void;

export const P: Record<string, Prod[]> = {
  dry: [["F 1001", "Basmati rice 5 kg", 5, 0.006], ["F 1033", "Sunflower oil 1.5 L", 1.5, 0.002], ["F 1108", "Salt 250 g", 0.25, 0.001]],
  chilled: [["F 2001", "Highland milk 1 L", 1.03, 0.0008], ["F 2014", "Anchor butter 200 g", 0.2, 0.0004], ["F 2030", "Curd 500 ml", 0.56, 0.0007]],
};
export const STAGES = ["Confirmed", "Planned", "Loading", "Out for delivery", "Delivered", "Receipt confirmed"];
export const DEF: Line[] = [{ n: "Basmati rice 5 kg", o: 6, r: 6 }, { n: "Sunflower oil 1.5 L", o: 4, r: 4 }, { n: "Salt 250 g", o: 4, r: 4 }];
export const init: State = {
  signed: false, route: "home", id: null, stream: "dry", q: {}, late: false, off: false, fail: false, loadFail: false,
  expired: false, modal: null, search: "", filter: "All", err: null, sent: null, qerr: false, photo: false, cur: null,
  orders: [
    { id: "ORD0092314", st: "Active", ty: "Fresh · Dry / ambient", info: "In transit · Expected arrival 06:24", stage: 4 },
    { id: "ORD0092308", st: "Needs action", ty: "Fresh · Chilled", info: "Driver recorded delivery 06:31 · 1 short item", stage: 5,
      lines: [{ n: "Highland milk", o: 10, r: 8 }, { n: "Anchor butter", o: 8, r: 8 }, { n: "Curd 500 ml", o: 6, r: 6 }] },
    { id: "ORD0092309", st: "Deferred", ty: "Fresh · Chilled", info: "Revised date: Wednesday 30 September", stage: 1 },
    { id: "ORD0092295", st: "Delivered", ty: "Fresh · Dry / ambient", info: "Receipt confirmed", stage: 6, done: true },
  ],
  notes: [
    { t: "Confirm your receipt", d: "ORD0092308 was delivered at 06:31.", u: 1, o: "ORD0092308" },
    { t: "Delivery moved", d: "ORD0092309 is now Wednesday 30 September.", u: 1, o: "ORD0092309" },
    { t: "ETA may be delayed", d: "ORD0092314 may arrive after 07:00.", u: 1, o: "ORD0092314" },
    { t: "Plan published", d: "Tonight's plan is published.", u: 0 },
  ],
};

/* ---------- helpers ---------- */
export const totals = (q: Qty) => {
  let u = 0, w = 0, v = 0;
  Object.values(P).flat().forEach((p) => { const n = q[p[0]] || 0; u += n; w += n * p[2]; v += n * p[3]; });
  return { u, w: +w.toFixed(2), v: +v.toFixed(4) };
};
export const lineList = (q: Qty) => Object.entries(P).flatMap(([s, ps]) => ps.filter((p) => q[p[0]]).map((p): [string, Prod, number] => [s, p, q[p[0]]]));
export const cls = (o: Order) => (o.st === "Needs action" ? "Needs" : o.st);
