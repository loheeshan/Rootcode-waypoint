# Integration handoff

Compact state of the frontend/backend integration. Update after every step.
Never record passwords, tokens or `.env` contents here.

## Branches

| Step | Branch | Base | Status |
|---|---|---|---|
| 1 Demo foundation | `feature/integration-demo-foundation` | `dev` `be6967e` (all backend batches incl. #201) | Done (`aa3add7`, merged #202) |
| 2 Auth (Store, Loader, Driver) | `feature/integration-demo-auth` | `dev` `68db449` | In review |
| 3 Store web | `feature/integration-store-web` | Step 2 | Pending |
| 4 Dispatcher web | `feature/integration-dispatcher-web` | — | **Deferred**: frontend team still building Dispatcher web |
| 5 Loader online | `feature/integration-loader-mobile` | Step 3 | Pending |
| 6 Driver online | `feature/integration-driver-mobile` | Step 5 | Pending |
| 7 Loader offline | `feature/integration-loader-offline` | Step 6 | Pending |
| 8 Driver offline | `feature/integration-driver-offline` | Step 7 | Pending |
| 9 Acceptance | `feature/integration-release-validation` | all | Pending (needs Step 4) |

Without the Dispatcher UI, Steps 5–8 use the demo scenario below to optimize, assign the
Driver and publish through the real services. That replaces the Dispatcher clicks only.

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
- Dispatcher web connection (Step 4) is deferred at the user's request.

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
- Dispatcher login is not connected (deferred with Step 4).

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
(from `dev`); not changed here.

## Next step

Step 3 on `feature/integration-store-web`: connect Store orders, tracking and receipts to the
API through `/api/backend`. Dispatcher login and Step 4 stay deferred.
