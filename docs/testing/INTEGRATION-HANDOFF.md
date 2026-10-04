# Integration handoff

Compact state of the frontend/backend integration. Update after every step.
Never record passwords, tokens or `.env` contents here.

## Branches

| Step | Branch | Base | Status |
|---|---|---|---|
| 1 Demo foundation | `feature/integration-demo-foundation` | `dev` `be6967e` (all backend batches incl. #201) | In review |
| 2 Auth (Store, Loader, Driver) | `feature/integration-demo-auth` | Step 1 | Next |
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

## Next step

Step 2 on `feature/integration-demo-auth`: real login for Store (web), Loader and Driver
(mobile). Dispatcher login stays with the Dispatcher web work.
