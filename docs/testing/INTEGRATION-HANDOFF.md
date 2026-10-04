# Integration handoff

Compact state of the frontend/backend integration. Update after every step.
Never record passwords, tokens or `.env` contents here.

## Branches

| Step | Branch | Base | Status |
|---|---|---|---|
| 1 Demo foundation | `feature/integration-demo-foundation` | `dev` `be6967e` (all backend batches incl. #201) | Done (`aa3add7`, merged #202) |
| 2 Auth (Store, Loader, Driver) | `feature/integration-demo-auth` | `dev` `68db449` | Done (`978bb94`) |
| 3 Store web | `feature/integration-store-web` | Step 2 `978bb94` | Done (`e6b42be`, merged #205) |
| 4 Dispatcher web | `feature/integration-dispatcher-web` | `dev` `865f0f8` | Done (`291c0f9`, merged #208) |
| 5 Loader online | `feature/integration-loader-mobile` | `dev` `066dcad` | Done (`b865967`, merged #206) |
| 6 Driver online | `feature/integration-driver-mobile` | `dev` `8113aa3` | Done (`5a0c6ce`, merged #207) |
| 7 Loader offline | `feature/integration-loader-offline` | `dev` `865f0f8` | Done (`a9a0af8`, merged #209) |
| 8 Driver offline | `feature/integration-driver-offline` | Step 7 `a9a0af8` | In review (not device-tested) |
| 9 Acceptance | `feature/integration-release-validation` | all | Pending (needs Step 8) |

Steps 5–6 were verified with the demo scenario below (optimize, assign the Driver, publish through
the real services) because the Dispatcher UI was not connected yet. From Step 4 on, the Dispatcher
web app does the same through the API; the scenario remains a shortcut for fixtures.

## Step 1 baseline (2026-10-04, Windows, Node 22.20.0, pnpm 10.34.6, Python 3.12)

| Check | Result |
|---|---|
| Docker `api`/`postgres` health | PASS (healthy) |
| `alembic current` (dev DB) | `0014_audit_events (head)` |
| Demo accounts in dev DB | 4 present (emails only checked; passwords not used) |
| Backend ruff / mypy / pytest | PASS: 1138 passed, 16 skipped (PostgreSQL-only); demo tests also 9/9 on PostgreSQL 17 |
| `pnpm test` (shared client) | PASS 8/8 |
| `pnpm build` (web) | PASS (`/`, `/store`, `/dispatcher` static) |
| `pnpm export:mobile` | PASS (Driver and Loader bundles) |
| `pnpm lint` | **FAIL, pre-existing**: 13 errors in Driver/Loader mobile (unused vars, `any`, `require`, unused expressions) |
| `pnpm typecheck` | **FAIL, pre-existing**: `driver-mobile` `TurnByTurnCard.tsx` icon names `turn-right`/`turn-left`; web and Loader pass |

Pre-existing frontend failures were recorded, not changed; fix them in the step that
touches those screens. Builds/exports are not evidence that a user journey works.

## Demo data

Prerequisites, in order (dev/test only, `APP_ENV=development|test`):

```powershell
docker compose up -d --build --wait api
docker compose exec api alembic upgrade head
docker compose exec api python -m app.auth.seed --demo     # prompts for a NEW-account password
docker compose exec api python -m app.fleet.seed --demo
docker compose exec api python -m app.demo.check_logins     # prompts; prints PASS/FAIL per role
docker compose exec api python -m app.demo.scenario --stage <stage> [--date YYYY-MM-DD] [--record-missing-fuel-as-zero] [--output /tmp/optimize.json]
```

| `--stage` | Date | Result |
|---|---|---|
| `plan` (default) | next free Store-valid date | 4 Store orders (through the Store service, except same-day dates; one oversized, deferred later) + draft plan; optimize input via `--output file.json` |
| `published` | next free date | + optimized and published, both trips assigned to `driver@waypoint.demo` |
| `ready` | next free date, or today via `--date` | + every order LOADED, trips READY |
| `operations` | today only | + first trip delivered with placeholder POD, second failed (`OUTLET_CLOSED`), one shortfall (`MISSING`), trips completed: Store receipt, exceptions and audit fixtures |

- Fixed IDs: depot `DEMO_DEPOT_ID`, Store outlet `DEMO_STORE_ID`, reefer van and ambient truck
  from `app/fleet/seed.py`; the command prints the generated order/plan/revision/trip IDs.
- Travel data is synthetic (`Synthetic demo travel matrix (not real road data)`): 6 km/15 min
  depot legs, 3 km/10 min outlet legs, 10 min service, van then truck shifts that do not
  overlap so the single demo Driver can take both.
- Same-day orders cannot be created through the Store API (it accepts future dates), so the
  `operations` stage and `--date <today>` seed those order rows directly as `CONFIRMED`. All
  later steps run through the real services and server clock.
- One plan per depot and date: reruns choose the next free date; a taken date is refused.
  Today's date can hold only one fixture, so `ready` for Driver testing and `operations`
  cannot both exist today in the same database. Use a fresh disposable database to repeat.
- The optimizer needs daily consumed-fuel totals from Monday to today of the plan week.
  Missing totals stop the run before any write unless `--record-missing-fuel-as-zero` is
  passed, which records `0.000` L for exactly those days. Prefer real totals via the fleet
  input API on shared databases.
- All checks (date, Store cutoff, exactly the two seeded vehicles, availability, timing,
  fuel) run before the first write. A failure after writing (for example a solver error)
  reports that earlier steps stayed committed; use another `--date` or a disposable database.
- Timing: shifts start at 07:30 or 25 minutes from now. The Store outlet closes at 18:00
  Colombo time; same-day `ready` needs the van to arrive in time and `operations` needs
  both the van and the truck (van shift is 2.5 h, truck starts 15 min later), so run
  `operations` before about 14:00 Colombo time.
- Each run uses one server time for its events, so fixture timelines have zero durations.

## Environment and connectivity

| Setting | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `apps/web/.env` | `http://localhost:8000/api/v1` (already includes `/api/v1`; never append it again) |
| `EXPO_PUBLIC_API_URL` | each mobile `.env` | Android emulator `http://10.0.2.2:8000/api/v1`; physical phone `http://<PC LAN IP>:8000/api/v1` (not `localhost`); restart Metro after changes |
| `CORS_ORIGINS` | root `.env` / `apps/api/.env` | JSON list incl. `http://localhost:3000`; native apps are not subject to CORS |
| Ports | `API_PORT`, `WEB_PORT`, `POSTGRES_PORT` | API 8000, web 3000, Metro Driver 8081 / Loader 8082; Postgres host port is `POSTGRES_PORT` (default 5432; 15432 on this machine's `.env`) |
| `JWT_SECRET_KEY` | private `.env` | set per `apps/api/app/auth/README.md`; never commit |

For a phone, also allow inbound TCP 8000 on the PC firewall and keep both on one network.

## API decisions

- Real login is `POST /api/v1/auth/login` (email/password) + `GET /api/v1/me`; there is no
  refresh token. Driver badge/PIN and Loader shift-PIN screens are UI mocks to replace.
- Loading and delivery are per order (weight/volume/temperature); there are no SKU/carton counts.
- Dispatcher web (Step 4) uses the same session cookie and proxy as the Store web app.

## Step 2: real login (Store web, Loader and Driver mobile)

- Shared `signIn()` in `@waypoint/api-contracts`: `POST /auth/login`, requires the app's role
  and reports `invalid-credentials`, `wrong-role`, `unavailable` or `network` separately.
- Web session: Next.js routes `/api/session` (POST sign-in, GET `/me`, DELETE sign-out) keep
  the API token in an httpOnly `SameSite=Strict` cookie; browser code never sees it. The
  cookie is `Secure` over HTTPS, behind a TLS proxy that sends `X-Forwarded-Proto: https`, or
  when `SESSION_COOKIE_SECURE=true`. `/api/backend/*` proxies to FastAPI with the bearer token,
  rejects `.`, `..` and empty path segments, and requires `X-Waypoint-Client: web` on writes;
  `/api/session` POST/DELETE require it too (blocks cross-site login/logout). "Keep me signed
  in" sets the cookie lifetime to the token lifetime; otherwise it is a browser-session cookie.
  There is no refresh token and no revocation endpoint: sign-out removes the cookie or stored
  token, and the token itself stays valid until it expires (30 minutes by default).
- `API_INTERNAL_URL` (Compose: `http://api:8000/api/v1`) is the server-side API base for the
  web container; local `next dev`/`start` fall back to `NEXT_PUBLIC_API_URL`.
- Mobile: `AuthProvider` per app; the token and last confirmed profile are stored in
  SecureStore only when "Remember on this phone/device" is checked, otherwise kept in memory.
  On relaunch `/me` confirms the session; a 401 clears it ("session expired"). Without
  connectivity a remembered session continues **offline and unverified** from the cached
  profile so cached work stays reachable; it is re-checked with `/me` when NetInfo reports a
  connection, and any API 401 signs out. `AuthGate` redirects protected deep links to sign-in
  once signed out (a protected screen can render briefly while the first check runs). End
  shift (Driver: Profile -> End shift; Loader: profile -> End shift and sign out) signs out
  and keeps local records.
- Driver badge/PIN and Loader bay-lead/PIN mocks were replaced by email/password. Biometric
  and NFC buttons are hidden (no backend support); password reset shows an honest note.
  Development builds show the demo email as a one-tap fill; the password is always checked.
  The Driver login no longer shows the mock vehicle card, "Pre-Trip Ready" or device label
  (they were static data); this differs from the design and needs design sign-off. Old PIN,
  biometric and reset-PIN screens remain in both apps but are no longer linked from sign-in.
- The Store mock "Expire session" demo control was removed: it changed UI state only while
  the real cookie stayed valid.
- Dispatcher login is connected in Step 4.

Verification (production web build on a disposable database with a generated test password):

| Check | Result |
|---|---|
| Store: wrong password | PASS: "Email or password is incorrect.", no navigation |
| Store: valid Dispatcher account on Store app | PASS: "This account does not have access to this app.", no cookie |
| Store: sign-in -> Store home, `/me` STORE_MANAGER with 1 outlet | PASS |
| Store: real read `GET /store/orders` via proxy | PASS (200); Dispatcher endpoint 403; write without client header 403 |
| Store: token readable by page scripts | PASS (not readable) |
| Store: reload keeps session; sign-out clears it; `/store` then shows sign-in | PASS |
| Store: token expiry (1-minute test tokens) | PASS: remembered cookie expires with the token; session cookie shows "Your session has expired" |
| Store after review hardening (rebuilt) | PASS: login/read/sign-out with the client header; header-less login POST 403 |
| Route tests (`apps/web/tests/session-routes.test.ts`) | PASS: cookie flags, Secure via `X-Forwarded-Proto`, CSRF header, failure mapping, expiry, sign-out, proxy path/header/Location rules |
| Driver/Loader native sign-in on emulator/device | NOT RUN (see below) |
| Shared + web tests (`pnpm test`) | PASS 20/20 (7 sign-in, 5 session/proxy route tests) |
| Web typecheck/build, Loader typecheck, both mobile exports | PASS |
| `pnpm lint` | Pre-existing 9 errors remain (13 before; Driver `index.tsx` rewrite fixed 4); none in Step 2 files |
| Driver typecheck | Pre-existing `TurnByTurnCard.tsx` icon errors only |

Mobile NOT RUN: Android virtual devices exist on this machine but running the apps needs
Expo Go on the emulator. Manual check with your API running and demo data seeded:

1. Set `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1` in each app's `.env`.
2. Start an emulator from Android Studio, then `corepack pnpm dev:driver` and press `a`.
3. Sign in as `driver@waypoint.demo` (wrong password, `loader@waypoint.demo` wrong role,
   correct password -> Today); kill and relaunch (remembered -> Today; unchecked -> sign-in);
   relaunch in airplane mode while remembered (-> Today, offline), then reconnect;
   Profile -> End shift -> sign-in screen.
4. Repeat with `corepack pnpm dev:loader` and `loader@waypoint.demo` (Welcome -> Start shift).

Known: the frontend team's Dispatcher sidebar/header now also renders around `/store`
(from `dev`); not changed here. Fixed in Step 4 (the shell moved to `app/dispatcher/layout.tsx`).

## Step 3: Store web connected to the API

- All Store screens use the scoped Store API through `/api/backend` (`apps/web/features/store/data/store.ts`);
  the runtime mock data, demo toggles, fake notifications and line-level issue modal were removed.
- New order = one consignment: temperature, weight (kg), volume (m³), requested date, outlet
  from `/me`. The server applies the 16:00 cutoff and returns the accepted date; the UI shows it.
  Creation is not idempotent, so the button is disabled while submitting and an uncertain
  failure tells the user to check My orders before resubmitting.
- Order list filters by real statuses with server pagination; Home counts use server totals.
- Order detail shows the real status timeline. Only `DELIVERED` orders offer Confirm receipt;
  the receipt request ID is reused for retries and a 409 "already confirmed" shows the saved receipt.
- The shared client now keeps the API error `detail`; `errorMessage()` shows server validation text.

Missing Store API fields (shown as unavailable, not invented): deferral reason and revised date,
ETA/route progress, outlet names, notifications, receipt discrepancies, and a failed-delivery
status (orders at a failed stop still read `OUT_FOR_DELIVERY` to the Store).

Verification (production web build, disposable database, generated test password; fixtures from
the `operations` scenario with a next-morning test clock):

| Check | Result |
|---|---|
| Home: outlet/email from `/me`, server counts, real orders | PASS |
| Invalid quantity (4 decimals) | PASS: client message, review disabled |
| Create order for tomorrow after 16:00, double-click submit | PASS: one order; server moved the date; cutoff message shown |
| Same-day date | PASS: server 422 message shown, draft kept, nothing created |
| Reload -> My orders | PASS: new order listed first with server values |
| Failed-stop order | PASS: timeline to "Out for delivery", no receipt action; API receipt POST 409 |
| Deferred order | PASS: honest deferral message, no receipt action |
| Delivered order -> Confirm receipt (double click) | PASS: one receipt, `RECEIPT_CONFIRMED`, saved record shown |
| Other outlet's order | PASS: not listed; detail and receipt 404 |
| `pnpm test` | PASS 25/25 (4 Store data tests, 1 client error-detail test) |
| Web typecheck / lint | PASS |
| Automated browser E2E | NOT ADDED: no E2E runner in the repo (Playwright would need a browser download) |

## Step 4: Dispatcher web connected to the API

All Dispatcher pages (`apps/web/app/dispatcher/*`, the frontend team's components and styles) now read
and write through `/api/backend` with the session cookie (`apps/web/features/dispatcher/data/dispatcher.ts`).
Their mock arrays, fake counters, illustrative maps and fake success notices were removed from the live flow.

- **Session**: `app/dispatcher/layout.tsx` -> `DispatcherShell` checks `/api/session?role=DISPATCHER`
  (also after reload) and shows the Dispatcher sign-in otherwise: wrong password, wrong role ("This account
  does not have access to this app.") and expiry use the Step 2 messages. The navbar shows the `/me` email,
  the depot (from `GET /fleet` `depots`) and a Colombo delivery date that scope every page; Sign out clears
  the cookie. The sidebar/navbar left the root layout, so `/store` no longer renders them.
- **Orders**: `GET /dispatcher/orders` with depot, accepted date (or all dates), real status tabs and server
  pagination. Outlet brand/district, window, van-only access and depot come from the API; brand categories,
  priority, export, "create order", "defer selected" and "batch plan" were removed (no API). Selection
  weight/volume are exact sums of the decimal strings.
- **Fleet inputs** (`/dispatcher/fleet`, new page; the Fleet modal now lists real vehicles): per vehicle and date,
  availability (Available/Unavailable) and the day's consumed fuel. GET keeps the `ETag`; PUT sends
  `If-None-Match: *` for an unrecorded day or `If-Match: <ETag>`, then re-reads for the next tag. A 412 reloads
  and shows the current server value. Fuel is sent as the typed decimal string (validated like the API); future
  dates cannot take fuel. Missing records read "Not recorded (unknown)", never a default. The page lists the
  Monday-to-today fuel days the plan week needs.
- **Plan workspace**: opening the page only looks up the depot/date plan; "Create plan workspace" posts it
  (409 loads the existing one). Inputs come from `GET /plans/{id}/compatibility` (eligible orders with candidate
  vehicles and exclusion reasons; vehicles with plan-day availability). The server plans **every** confirmed
  order of the date, so orders cannot be picked individually (gap below); vehicles are picked by availability.
  Optimize sends one service entry per eligible outlet, one shift per available vehicle (editable earliest
  departure/latest return/turnaround, Colombo time; same-day plans default to now + 30 min) and every directed
  depot/outlet leg. Travel data is **synthetic** (6 km/15 min depot legs, 3 km/10 min between outlets, service
  10 min by default), sent with `is_synthetic: true` and labelled in the request and on the page. The button is
  disabled until availability is recorded for every vehicle and fuel for every required day.
- **Results**: the saved `GET .../revisions/{id}/results` per revision: trips with vehicle, times, distance,
  fuel, weight/volume per trip against capacity (exact decimal sums of the orders), the stop sequence with
  arrival/service times and orders, and deferred orders with the server's reason code and text. Unpublished
  results read "Validated draft snapshot · not published" (`VALIDATED_SNAPSHOT`, `publishable: false`).
- **Driver assignment and publish**: one driver user ID per trip ("apply to all" helper), then
  `POST /plans/{plan}/revisions/{revision}/publish` with the revision ID. The publication card shows the
  effective revision, drivers, `REVALIDATED_AT_PUBLISH` counts and weekly fuel balances. Optimize and publish
  keep one `request_id` per payload until the server confirms it, so retrying an uncertain failure (network,
  502/503) can only replay; a changed payload or a confirmed result gets a new ID. A 409 (stale inputs, already
  published, departure passed) shows the server reason and reloads the plan, publication and inputs.
- **Live operations** (Trips page) and **dashboard**: `GET /operations/live`, `/operations/trips` (status
  filter, pagination), `/operations/exceptions` (kind filter, detail dialog) and `/operations/audit` (depot,
  optional selected trip). Trips show real statuses, loading progress, delivery progress and Store receipts;
  the stop sequence comes from the effective published revision's saved result. Counts only: on-time/SLA,
  percentages, ETA, GPS/offline and "late risk" were removed because the API does not return them.
- **Analytics**: the forecast was illustrative; it now says forecasts/utilisation are unavailable and lists
  only the configured fleet capacity per vehicle class from `/fleet`. Reports and Warehouses modals link to the
  audit log and switch between assigned depots.

API gaps (listed, not invented; no backend or contract change in this step):

- No driver directory: the Dispatcher enters the Driver's **user ID**. For the demo:
  `docker compose exec postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -Atc "select id from users where email='driver@waypoint.demo'"`.
  A `GET /drivers?depot_id=` (id, email/name) would allow a picker.
- Orders cannot be excluded from an optimization run (the server takes all `CONFIRMED` orders of the date).
- No real travel-time source; the synthetic matrix is labelled.
- No Dispatcher stop/trip detail with per-stop outcomes (only counts, exceptions and audit); no outlet names in
  operations, exceptions or saved stops (shown as short IDs unless the order list has them); no driver names.
- No forecast, utilisation, SLA/on-time, ETA or GPS data; no exports; no exception resolution, republish or
  revision edit endpoints. Plan creation, optimization and fleet input edits are not audited (API docs).

Verification (Linux container, Node 22.22, production `next build` + `next start` with `API_INTERNAL_URL`, FastAPI
on a disposable PostgreSQL 16 database at `0014_audit_events`, demo accounts with a generated password, headless
Chromium via ad hoc Playwright scripts kept outside the repo; 2026-10-04 ~22:40 Colombo, so orders created
"for tomorrow" were moved to 6 October by the cutoff):

| Check | Result |
|---|---|
| Dispatcher sign-in: wrong password / Store account / correct | PASS: "Email or password is incorrect." / "This account does not have access to this app." / dashboard with `/me` email and depot |
| Token readable by page scripts | PASS (`document.cookie` empty) |
| Store creates 3 orders (one 99,999 kg) -> Dispatcher Orders for that date | PASS: 3 confirmed orders with server outlet/window/quantities |
| Optimize disabled while availability is unknown | PASS ("Record availability for every vehicle") |
| Availability Available for both vehicles (`If-None-Match: *`) | PASS: 201 each, shown as recorded |
| Invalid fuel `1.2345` | PASS: validation text, save disabled, nothing sent |
| Fuel create `0.000` -> replace `12.5` (`If-Match`) -> changed in another session -> save | PASS: 201, 200 (`12.500`), 412 with server text and the other session's `20.000` shown |
| Create workspace -> optimize | PASS: revision 2, 1 trip, 2 served, oversized order deferred "No compatible vehicle" with server text; synthetic badge |
| Assign `driver@waypoint.demo` -> publish (double click) | PASS: one POST, 201; publication card with driver, fuel balance |
| Reload Planning | PASS: same effective revision 2, no optimize/publish controls |
| Loader API `GET /loader/trips` for the date | PASS: 1 trip, `PLANNED`, demo driver, 2 orders |
| Stale publication (Store order added after optimize) | PASS: 409 "Current orders, fleet or fuel no longer match this revision; run a new optimization" shown once; re-optimize -> revision 3 |
| Lost publish response (request reached the server, response dropped) -> publish again | PASS: uncertain message, retry reused the same `request_id`, server replayed 200, revision 3 published |
| Foreign depot filter via proxy / write without client header | PASS: 403 / 403 |
| Loader records LOADED + MISSING (note) and ready (API) -> Trips page | PASS: READY trip, 1 loaded 1 missing, "Missing at loading" exception with note, 5 audit entries |
| Empty date | PASS: "No plan for this depot and date", no trips, no exceptions |
| Sign out -> reload | PASS: sign-in shown |
| `pnpm test` | PASS 47/47 (15 new Dispatcher data tests) |
| `pnpm --filter @waypoint/web typecheck`, `eslint apps/web`, `pnpm build` | PASS |
| Delivered/failed stops, Store receipts and `RECEIPT_PENDING`/`DELIVERY_FAILED` in live operations | NOT RUN: needs a same-day trip before ~14:00 Colombo (manual step 6 below) |
| Two trips with one driver overlapping (422), fuel quota deferral/conflict, same-day plan default departure | NOT RUN (manual steps 4–5) |
| Automated browser E2E in the repo | NOT ADDED: no E2E runner in the repo |

Manual verification (your machine, real API, demo data; never record the password):

1. `docker compose up -d --build --wait api`, `alembic upgrade head`, `app.auth.seed --demo`, `app.fleet.seed --demo`
   (see Demo data), then `corepack pnpm build` and `corepack pnpm --filter @waypoint/web start`.
2. Store web (`/store`, `store@waypoint.demo`): create two small orders (one chilled) and one 99999 kg order for
   tomorrow; note the accepted date.
3. `/dispatcher` as `dispatcher@waypoint.demo` (also try a wrong password and the Store account). Set the
   navbar date to the accepted date. Orders: the 3 orders appear. Fleet inputs: mark both vehicles Available;
   if the plan week has started, record each day's fuel (try `1.2345`, then a valid value; edit the same value in
   a second browser and save in the first: 412 message). Planning: Create plan workspace -> Run optimization ->
   served trip(s) and the deferred order with its reason. Enter the demo Driver's user ID (gap above), Apply to
   all trips, double-click Publish -> one publication. Reload: same effective revision. Loader app or
   `GET /loader/trips?delivery_date=...`: the trips are visible.
4. Stale publication: on another date, optimize, create one more Store order for that date, publish -> 409
   reason shown; Run optimization again, publish.
5. Overlap: with two trips and one driver, set overlapping shifts (both 07:30–18:00) -> publish shows the 422
   reason; set van 07:30–10:00 and truck 10:15–12:45, re-optimize, publish.
6. Live operations: `app.demo.scenario --stage operations` (today, before ~14:00 Colombo) -> Trips for today shows
   delivered and failed stops, the `MISSING` exception, the pending receipt; confirm the receipt in the Store app
   -> receipts confirmed increments, `RECEIPT_CONFIRMED` appears in the audit log.
7. Wrong depot: `/api/backend/dispatcher/orders?depot_id=<another depot UUID>` in the signed-in browser -> 403.
   Double submit/replay: double-click Run optimization and Publish -> one revision / one publication.
   Empty data: choose a date without orders -> empty states; creating that plan and optimizing saves an empty revision.

## Step 5: Loader mobile connected to the API (online)

- Today lists `GET /loader/trips` for today's Colombo date in the account's depots; the header
  shows the depot from `/me` (no static location or alert dot). Filters use real trip statuses.
- Checklist shows `GET /trips/{id}/loading`, stops last-first. Loading is per whole order:
  Loaded, or Problem -> Missing/Damaged with a required note (max 500). No carton counts.
- Each action gets one `event_id` (expo-crypto UUID), kept across retries of the same action
  until the server accepts it; a second tap while a request is in flight is ignored.
- Mark ready sends a `request_id` per `last_event_sequence`. A 409 (stale sequence or finalized
  trip) reloads the server view and shows the reason; READY is shown only from the server response.
- Finalized trips show no edit controls. Offline queueing is not part of this step (Step 7):
  without a connection, actions fail with "Nothing was saved" and nothing is marked done.
- Responses for a trip that is no longer selected are dropped; a failed refresh keeps the last
  server view and says it could not refresh (never "Nothing was saved" after a saved event).
  When an order's outcome is saved, unconfirmed IDs for that order are discarded so they are
  never replayed later. Today refetches when shown.
- Fix in both mobile apps: a 401 ends the session only when a token was sent and is still current
  (a fresh install briefly showed "Your session has expired").

Verification (Pixel 7 emulator, Expo Go, disposable database with a generated test password,
`published` scenario for today with a 07:00 test clock):

| Check | Result |
|---|---|
| Wrong password / Driver account in Loader | PASS: "Email or password is incorrect." / "This account does not have access to this app." |
| Sign-in -> Today with server trips and depot | PASS: 2 trips, real times/stops/orders |
| Manifest, double-tap Loaded | PASS: 1 LOADED event stored |
| Missing with empty note, then with note | PASS: validation message; MISSING saved and listed as exception |
| Stale ready (event recorded elsewhere, then Mark ready) | PASS: 409, view refreshed, "Loading changed since your last refresh" |
| Double-tap Mark ready | PASS: one 201, one completion row; READY with server counts |
| Driver API `GET /driver/trips` | PASS: trip 2 READY |
| Edit or re-ready finalized trip (API) | PASS: 409 "Loading is finalized" |
| Loader in another depot (API) | PASS: empty list; view/event 404 |
| Driver / Store token on Loader endpoints; no token | PASS: 403 / 403 / 401 |
| Kill and relaunch (remembered) | PASS: Today refetched, trip READY, checklist locked |
| After Guardian review: switch trip, tap at once | PASS: old manifest cleared; no event sent to the wrong trip |
| Retry after a network failure on the device | NOT RUN: needs the API stopped mid-request; same-ID replay is covered by backend tests |
| Loader typecheck / lint, `pnpm test` (25/25), Loader export | PASS |
| `pnpm typecheck` / lint | Pre-existing Driver errors only (`TurnByTurnCard.tsx` icons; 6 lint errors) |

Not changed: older prototype screens under `src/features/flows`, `dialogs` and `choose-depot`
(e.g. Profile, Settings, Notifications from the header) still show static text. The Today ->
Checklist -> Report -> Depart flow no longer links to them.

## Step 6: Driver mobile connected to the API (online)

- Today lists `GET /driver/trips` for today's Colombo date; Stops shows `GET /trips/{id}` in sequence.
  Start is shown only for `READY` (the server performs READY -> IN_PROGRESS); before that the trip
  reads "Waiting for loading" and deliverability is not shown as final.
- Stop: arrive, then proof of delivery, or "Could not deliver" (one backend reason code + required
  note, allowed before or after arrival as the API allows). Orders not loaded are marked "do not deliver";
  a failed stop always reads "Not delivered" and its orders are never shown as delivered.
- Proof matches the API exactly: receiver name + one photo. No signature or quantities are collected.
  The camera photo is re-encoded as JPEG and shrunk only until it fits 1,000,000 bytes, then kept in the
  app's document folder with a small record (`pod_id`, receiver, capture time, user). Retries and
  relaunches re-send the same `pod_id` and bytes; a changed receiver or photo gets a new `pod_id`; the
  local copy is deleted once the server has the proof, and drafts from another account are discarded.
  Deliver uses the server's `pod_id`. The stored photo is read back from `GET .../pod`.
- Start, arrive, deliver, fail and complete reuse one `event_id` per action until accepted; double
  taps are ignored while a request is in flight; 409s reload the server view and show the reason.
- Camera denied (re-askable or blocked -> Open settings), cancelled and unusable photos have their own states.
- Proof and failure forms are rebuilt for each stop (hidden tab routes otherwise keep the previous
  stop's receiver, reason or note); late draft loads and out-of-order trip reloads are ignored; viewed
  proof photos are removed from the cache on sign-out or expiry; errors from another stop are cleared.
- Both mobile apps: requests abort after 30 s (90 s for large uploads) and show a connection error
  instead of spinning forever; the timer is cleared when the request finishes.
- Offline saving is Step 8: without a connection actions fail with "Nothing was confirmed".

Verification (Pixel 7 emulator, Expo Go SDK 56, disposable database with a generated test password,
`published` scenario for today; Loader steps through the real Loader API):

| Check | Result |
|---|---|
| Sign-in as `driver@waypoint.demo` -> Today with 2 server trips | PASS |
| Trip not READY | PASS: "Waiting for loading", no Start |
| Loader marks ready -> pull to refresh -> Start (double tap) | PASS: one 201, IN_PROGRESS |
| Arrive | PASS: server arrival time shown |
| Upload with no photo | PASS: validation, nothing sent |
| Camera denied once / twice | PASS: "Camera access needed" / "Camera permission denied" + Open settings |
| Camera cancelled | PASS: "No photo taken" |
| Photo captured | PASS: 26 KB JPEG kept on the phone |
| Upload with API stopped | PASS (after fix): times out with "Cannot reach the Waypoint server"; before the fix it spun forever |
| Kill and relaunch | PASS: remembered session; draft photo and receiver restored |
| Upload (double tap) | PASS: one 201; photo read back from the server (200) |
| Deliver (double tap) -> complete | PASS: one 201 each; trip COMPLETED, 1 delivered |
| Trip with one MISSING order -> "Could not deliver" empty, then Outlet closed + note | PASS: validation; one 201; stop FAILED; missing order "do not deliver" |
| Store view of orders (API) | PASS: delivered order DELIVERED; failed stop's orders OUT_FOR_DELIVERY / LOADING (never DELIVERED) |
| Invalid images (API) | PASS: bad base64, text as JPEG, JPEG declared PNG, GIF type, blank receiver -> 422; oversized -> 413; deliver without POD -> 409 |
| Another driver (API) | PASS: empty list; detail, POD, start, arrive -> 404 |
| Loader / Store on Driver endpoints (API) | PASS: 403 (Store cannot read POD photos) |
| Action on a completed trip (API) | PASS: 409 "The trip is not in progress" |
| Duplicates (DB) | PASS: 2 TRIP_STARTED, 2 ARRIVED, 1 DELIVERED, 1 FAILED, 2 TRIP_COMPLETED, 1 POD |
| `pnpm test` | PASS 32/32 (7 new POD draft tests: pod_id reuse/renewal, retake cleanup, relaunch, other account, denied/cancelled, size fitting) |
| Driver + Loader typecheck, both exports, Driver driving files lint | PASS (Driver keeps the pre-existing `TurnByTurnCard` typecheck errors and 6 lint errors) |
| After Guardian review (fresh database): fail a stop that already has proof; Trip 2 proof/deliver/complete | PASS: failed stop hides its proof and reads "Not delivered"; new forms open empty; delivery confirmed |
| Form state across two stops of one trip | NOT RUN on device: the demo scenario has one stop per trip and Expo Go deep links reload the app; fixed by remounting the proof and failure forms per stop and ignoring late draft loads (code review) |
| Physical device / iOS | NOT RUN: emulator only |

Notes: Expo Go asks for camera access per project in addition to Android's prompt. `app/start-trip.tsx`
(from the frontend team) is an empty route file and triggers an Expo Router warning; not changed.
Prototype screens not on this flow (`next-stop-*`, `trip-complete`, `photo-attention`, offline failure, etc.)
still show static design data.

## Step 7: Loader offline persistence and sync

- New shared package `@waypoint/mobile-sync` (no Expo imports; each app passes its own SQLite):
  per-account outbox with immutable rows (SQLite trigger), batches of at most 50 in creation order,
  per-trip causal blocking, per-event outcomes (APPLIED/DUPLICATE -> synced; REJECTED/CONFLICT ->
  needs attention, never resent automatically; RETRY/network -> bounded backoff 2 s..5 min;
  SKIPPED -> waits for the earlier event), 401/403 pause without losing work, relaunch recovery.
- Loader: schema v2 (trip list and trip views cached per user; ready requests). Changes are saved on
  the phone first and shown as "Saved on phone · waiting to sync"/"Sending…". Ready is a stored
  request sent only after the trip's loading changes are acknowledged, with the server's sequence.
  Details in `apps/loader-mobile/src/sync/README.md`.

Verification (Pixel 7 emulator, Expo Go SDK 57, disposable database):

| Check | Result |
|---|---|
| Sign in, open both trips, airplane mode | PASS: cached trips and checklist shown with "Offline" notice |
| Offline: Loaded, Missing with note, double tap Loaded, Ready request | PASS: saved on phone, counts update, double tap adds nothing; Depart shows "Ready requested — not yet confirmed", trip not READY |
| Kill and relaunch with network on but API stopped | PASS: 5 changes survive; sync fails quietly and backs off |
| API back; same trip finalized from another session meanwhile | PASS: Trip 2 changes APPLIED, then TRIP_READY with server sequence -> READY (Driver API sees READY); Trip 1 change CONFLICT shown with server reason, discarded by the user |
| Exactly once (DB) | PASS: 3 LOAD_RECORDED + 1 TRIP_READY receipts; 1 completion per trip |
| Expired session (new JWT secret) | PASS: "Your session has expired"; queue kept |
| Account switch: loader1 records offline, signs out (warning shows 1 unsynced), loader2 signs in online | PASS: loader2 sees no local change and makes 0 sync calls; loader1 signs in again -> change synced once |
| Tests | PASS: `pnpm test` (outbox 11, overlay 3, plus existing) |
| Physical device / iOS | NOT RUN |
| Partial batch / RETRY / 50-event batches / stale sequence | Covered by unit tests against real SQLite (not on device) |

## Step 8: Driver offline persistence and sync

Same design as Step 7 on the shared outbox; details in `apps/driver-mobile/src/sync/README.md`.
Driver actions are saved on the phone first; proof photos upload (idempotent `pod_id`) before the
queued delivery is sent; READY for start comes only from the server copy; per-account storage.

| Check | Result |
|---|---|
| Driver typecheck (only pre-existing `TurnByTurnCard` errors), lint on changed files | PASS |
| Emulator: offline start/arrive/proof/deliver/fail/complete -> relaunch -> reconnect, exactly once | NOT RUN (skipped at the user's request) |
| Expired session, conflict, duplicate retry, account switch on Driver | NOT RUN |

Manual check: follow the Step 7 table with `driver@waypoint.demo` and Expo Go SDK 56; confirm
`proof_of_delivery` has one row per delivered stop and `sync_events` has one receipt per action.

## Next step

Step 9 acceptance on `feature/integration-release-validation` once Step 8 is merged.
