# Role acceptance checklist

Record each row as PASS, FAIL or NOT RUN with evidence. Use the real FastAPI/PostgreSQL backend;
mocked responses do not count. Never record passwords. Earlier steps' evidence is in
[INTEGRATION-HANDOFF.md](INTEGRATION-HANDOFF.md).

**Step 9 run (2026-10-04):**
- Environment: Linux container, disposable PostgreSQL 16.14 database `waypoint_acceptance` at
  `0014_audit_events`, generated seed password and JWT key, FastAPI on port 8000, production web
  build on port 3000.
- Web: headless Chromium driven by ad hoc Playwright scripts kept outside the repo.
- Mobile: no Android emulator here. "API" rows send the exact REST/sync calls the Loader and Driver
  apps make, with the role's own token; "Outbox" rows run the shared `@waypoint/mobile-sync` Outbox
  on a file SQLite database, with process restarts standing in for app relaunches.
- Delivery-day steps ran with the API's domain clock dependencies (`get_*_time`, the seam the backend
  tests override) started at 6 Oct 07:15 Colombo. Auth used the real clock.
- IDs carried through every role: Store orders `0B275A52` (C1), `AFF7B2EE` (C2), `E6D4C858` (T),
  `B6A505A3` (D); plan `51417E3B`; revision 2 `A8A7E3CB`; van trip `116D5A1B` (stop `70999670`);
  truck trip `D7401A41` (stop `7DF9E73C`).

## Main flow (same IDs throughout)

| Role / flow | Command or UI steps | Expected | Actual | Evidence | Blocker |
|---|---|---|---|---|---|
| Store: create orders | `/store` -> New order ×4 (2 chilled, 3000 kg, 99999 kg) for 5 Oct, double-click Submit | One order per submit, accepted date shown | PASS | One `POST /store/orders` 201 each; cutoff moved 5 -> 6 Oct (23:04 Colombo) | — |
| Dispatcher: orders | `/dispatcher` -> date 6 Oct -> Orders | The 4 orders, server values | PASS | All 4 IDs listed as Confirmed | — |
| Dispatcher: fleet inputs | Fleet inputs -> Available ×2 | `If-None-Match: *` creates | PASS | 2× PUT 201 | — |
| Dispatcher: optimize | Planning -> Create -> shifts van 07:30–10:00, truck 10:15–12:45 -> double-click Run | One revision; served/deferred with reasons; synthetic label | PASS | 1 POST 201; rev 2: van C1+C2 (120.5/1200 kg), truck T (3000/5000 kg), D `NO_COMPATIBLE_VEHICLE` | — |
| Dispatcher: assign + publish | Driver ID, Apply to all, double-click Publish | One publication of the revision ID; reload same | PASS | 1 POST 201 (`.../revisions/a8a7e3cb.../publish`); reload shows "#2 Effective published" | Driver ID typed (no directory API) |
| Loader: trips + manifest | API `GET /loader/trips`, `GET /trips/{van}/loading` | Published trips, stop-ordered orders | PASS (API) | 2 trips PLANNED, demo driver, 2+1 orders | Device NOT RUN |
| Loader: LOADED / MISSING / ready | API load-events (C1 LOADED twice, C2 MISSING ± note), ready (stale, then current, then replay) | One event per ID; note required; READY confirmed | PASS (API) | 201 then 200 same sequence; 422 without note; stale 409; ready 201, replay 200; edit after ready 409 | Device NOT RUN |
| Driver: start -> arrive -> POD -> deliver -> complete | API on 6 Oct: van trip | Start only READY; deliver needs POD; one effect per ID | PASS (API) | start 201/200; arrive 201; deliver w/o POD 409; POD 201/200 (2378 B JPEG); deliver 201/200; complete 201; later arrive 409 | Device and camera NOT RUN |
| Store: delivered -> receipt | My orders -> C1 -> Confirm receipt (double-click) | One receipt; others no action | PASS | 1 POST 201; C1 Receipt confirmed; T, C2, D show no receipt button | — |
| Dispatcher: live ops + audit | Trips for 6 Oct | Server trip/order status, exceptions, outcome, receipt, audit | PASS | 2 Completed; delivery 1/2 (1 failed); loading 2/3 (1 missing); receipts 1; exceptions MISSING + DELIVERY_FAILED with notes; 16 audit entries | — |

## Failure case

| Role / flow | Command or UI steps | Expected | Actual | Evidence | Blocker |
|---|---|---|---|---|---|
| Driver: stop not delivered | Outbox: truck trip start, arrive, fail (`OUTLET_CLOSED` + note), complete | FAILED stop, trip COMPLETED | PASS (Outbox) | `delivery_events` TRIP_STARTED, ARRIVED, FAILED, TRIP_COMPLETED | Device NOT RUN |
| Store sees failure/shortfall/deferral | `/store` My orders and details | Never delivered; no receipt | PASS | T "Out for delivery", C2 "Loading", D "Deferred" with explanation; receipt API 409 for T and D | Store has no failed status (known gap) |
| Dispatcher sees them | Trips, Orders (All statuses), Planning | Failure, shortfall, deferral with reasons | PASS | Exceptions list; orders Deferred / Out for delivery / Loading / Receipt confirmed | — |

## Cross-cutting

| Role / flow | Command or UI steps | Expected | Actual | Evidence | Blocker |
|---|---|---|---|---|---|
| Logins, all four identities | `/store`, `/dispatcher` UI; `check_logins`; API login for Loader/Driver | Correct role and scope | PASS (web, API); NOT RUN (mobile screens) | `check_logins` PASS ×4 (outlets 1 / depots 1) | Emulator |
| Invalid password / wrong role | Both web logins | Messages, no cookie | PASS | "Email or password is incorrect." / "This account does not have access to this app."; no session cookie | Mobile NOT RUN |
| API down | Stop API, open `/store`, `/dispatcher` | Clear connection error | PASS | "Cannot reach the Waypoint server." | — |
| Expired session | Restart API with a new `JWT_SECRET_KEY` | Sign-in again | PASS (web) | Both web apps: "Your session has expired" | Mobile NOT RUN |
| Logout | Sign out -> reload | Sign-in shown, cookie cleared | PASS (web) | Both web apps | Mobile NOT RUN |
| Cross-resource access | API with each role's token | 401/403/404 | PASS | Loader/Store/Driver/Dispatcher on other roles' routes 403; foreign depot 403; unknown plan/order/trip 404; unassigned outlet create 403; no token 401 | Second Driver/outlet not seeded (other-driver 404 covered by backend tests) |
| Loader offline + relaunch + account switch | Outbox: LOADED offline ×2 attempts -> Driver signs in on same file -> Loader relaunch online -> ready with lost response -> relaunch | Survives, other account never sends, applied once | PASS (Outbox) | Driver run sent 0; then APPLIED; ready DUPLICATE on retry; `load_events` 1, `trip_loading_completions` 1, `sync_events` 1 each | Device NOT RUN |
| Driver offline + relaunch | Outbox: 4 events offline -> relaunch with lost response -> relaunch | Applied once | PASS (Outbox) | All DUPLICATE on retry; 4 `delivery_events`, 4 `sync_events` | Device NOT RUN |
| Driver offline delivery with proof | App `runDriverSync` (Expo modules mocked) + real Outbox vs live API: start, arrive, proof, deliver, complete offline -> relaunch -> online | Proof once, events once | **FAIL -> fixed -> PASS** | Before fix: proof 409, delivery CONFLICT (regression test); after: 4 APPLIED, 1 `proof_of_delivery`, trip COMPLETED, re-run sends nothing | Device NOT RUN |
| Camera denied/cancelled | Driver app | Own states | NOT RUN | Step 6 emulator PASS | Emulator |
| Double submit / replay | Every write above | One server effect | PASS | Order, optimize, publish, receipt: 1 POST each; load/ready/start/POD/deliver replays 200 | — |
| Web empty/error states | Empty date, API down | Empty/error views | PASS | Step 4 + this run | — |

## Validation matrix (Step 9)

| Check | Result |
|---|---|
| `alembic upgrade head` on an empty database | PASS (`0014_audit_events`) |
| `ruff check .` / `mypy app` | PASS / PASS (88 files) |
| `pytest` | PASS 1138, 16 skipped (PostgreSQL-only) |
| PostgreSQL-only concurrency tests on PostgreSQL 16 | PASS 17/17 (ad hoc plugin pointing the shared `engine` fixture at fresh databases) |
| `pnpm lint` | FAIL, pre-existing: 6 driver-mobile errors (`(tabs)/_layout.tsx`, `metro.config.js`, `AppTabBar.tsx`) |
| `pnpm typecheck` | FAIL, pre-existing: driver-mobile `TurnByTurnCard.tsx` icon names; all others pass |
| `pnpm test` | PASS 64/64 (3 new Driver sync tests) |
| `pnpm build` (web) / `pnpm export:mobile` | PASS / PASS |
| E2E runner in repo | None (not added) |
