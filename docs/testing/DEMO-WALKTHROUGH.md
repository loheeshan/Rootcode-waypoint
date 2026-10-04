# Demo walkthrough

> For reviewers: `docker compose up` runs the whole demo with seeded data and demo logins; see
> [DEMO-CREDENTIALS.md](../../DEMO-CREDENTIALS.md). This page is the manual, step-by-step setup.

How to run the integrated Waypoint demo (Store web, Dispatcher web, Loader and Driver Android)
on one Windows machine against a **disposable** database. Commands are PowerShell from the repo
root unless noted. Never put the demo password, `JWT_SECRET_KEY` or `.env` files in Git, chat or docs.

## 1. One-time setup

```powershell
corepack pnpm install --frozen-lockfile
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1   # creates missing .env files only
docker compose up -d --wait postgres
```

Root `.env` and `apps/api/.env` must have the same `POSTGRES_PASSWORD`; `POSTGRES_PORT` is the host
port (15432 on this machine). `apps/web/.env` needs `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`.

## 2. Disposable demo database (never your main `waypoint` database)

```powershell
docker compose exec postgres createdb -U waypoint waypoint_acceptance
Set-Location apps\api
uv sync --frozen
$env:APP_ENV = 'development'
$env:POSTGRES_DB = 'waypoint_acceptance'                      # overrides apps/api/.env for this terminal
$env:JWT_SECRET_KEY = (uv run python -c "import secrets; print(secrets.token_urlsafe(48))")
uv run alembic upgrade head                                    # expect 0014_audit_events (head)
uv run python -m app.auth.seed --demo                          # prompts twice for a NEW demo password
uv run python -m app.fleet.seed --demo
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000         # keep this terminal open
```

In a second terminal with the same three `$env:` values: `uv run python -m app.demo.check_logins`
(prompts for the password; prints PASS per role and never the password).

**The seed password**: choose it at the seed prompt (12+ bytes), keep it in your password manager,
and type it into each login screen. There is no default password and no script stores it.
Restarting the API with a different `JWT_SECRET_KEY` signs everyone out ("Your session has expired").

## 3. Start the apps

| App | Command | URL / route |
|---|---|---|
| API docs | (API terminal above) | http://localhost:8000/docs, readiness http://localhost:8000/ready |
| Web (Store + Dispatcher) | `corepack pnpm build; corepack pnpm --filter @waypoint/web start` (or `corepack pnpm dev:web`) | http://localhost:3000/store, http://localhost:3000/dispatcher |
| Loader (Expo SDK 57, Metro 8082) | `corepack pnpm dev:loader` then `a` | `adb shell am start -a android.intent.action.VIEW -d exp://10.0.2.2:8082` |
| Driver (Expo SDK 56, Metro 8081) | `corepack pnpm dev:driver` then `a` | `adb shell am start -a android.intent.action.VIEW -d exp://10.0.2.2:8081` |

- Mobile API URL (`apps/loader-mobile/.env`, `apps/driver-mobile/.env`):
  emulator `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1`; physical phone `http://<PC LAN IP>:8000/api/v1`
  (allow inbound TCP 8000 in the firewall, same Wi-Fi). Restart Metro after changing it.
- Expo Go must match each SDK (`npx expo start --android --go` installs the right one).
- Emulator: AVD `Pixel_7`. If it will not start, delete `Pixel_7.avd\*.lock` and cold boot with
  `-no-snapshot-load`. Airplane mode for offline demos:
  `adb shell cmd connectivity airplane-mode enable` / `disable`.
- If a port is busy use spare ones (API 8001, web `next start -p 3100`) and update the URLs and `CORS_ORIGINS`.

## 4. Accounts

| Role | Email | App |
|---|---|---|
| Store Manager | `store@waypoint.demo` | web `/store` |
| Dispatcher | `dispatcher@waypoint.demo` | web `/dispatcher` |
| Loader | `loader@waypoint.demo` | Loader app |
| Driver | `driver@waypoint.demo` | Driver app |

All four use the password you chose at the seed prompt. Each app rejects the other roles
("This account does not have access to this app.").

## 5. Dates (Asia/Colombo, UTC+05:30)

- The Store accepts future dates only. Before 16:00 Colombo, "tomorrow" is accepted; at or after
  16:00 it moves one more day (the confirmation shows the accepted date).
- Trips can only be **started on their delivery date**. So the full chain in real time is:
  Store orders before 16:00 for tomorrow -> Dispatcher publishes today -> Loader and Driver work tomorrow.
- For a same-day demo, use the fallback fixture (next section) for today, before about 14:00 Colombo.

## 6. Fallback fixtures (demo scenario, disposable database only)

```powershell
uv run python -m app.demo.scenario --stage published --date <today YYYY-MM-DD> [--record-missing-fuel-as-zero]
```

Stages: `plan` (orders + draft plan), `published` (optimized, both trips assigned to the demo Driver),
`ready` (all orders LOADED, trips READY), `operations` (today only: one delivered stop, one failed
stop, one shortfall). One plan per depot and date; reruns pick the next free date. See
[INTEGRATION-HANDOFF.md](INTEGRATION-HANDOFF.md#demo-data). `--record-missing-fuel-as-zero` records
`0.000` L only for missing days; prefer real totals.

## 7. Reset / rerun

Only the disposable database is reset; your main `waypoint` database and accounts are never touched.

```powershell
# stop the API first
docker compose exec postgres dropdb -U waypoint --force waypoint_acceptance
docker compose exec postgres createdb -U waypoint waypoint_acceptance
# then repeat section 2 (migrate, both seeds); choose a new demo password if you like
```

Phones keep unsent work per account: sign out (or clear Expo Go data) before switching databases.

## 8. Role-by-role walkthrough

1. **Store** (`/store`): sign in -> New order -> temperature, weight, volume, date -> Review -> Submit.
   The confirmation shows the accepted date (cutoff applied). My orders lists it as Confirmed.
   Create a chilled order, a second chilled order, an ambient 3000 kg order and a 99999 kg order to see
   every outcome.
2. **Dispatcher** (`/dispatcher`): sign in; set the navbar date to the accepted date.
   - Orders: the Store's orders with outlet, window and access.
   - Fleet inputs: mark both vehicles Available for that date. Record each day's fuel from Monday
     through today once the plan week has started.
   - Planning: Create plan workspace. Set shifts: van 07:30–10:00, truck 10:15–12:45, so one driver can take both trips. Run optimization.
     Served trips (stop sequence, weight/volume per trip) and deferred orders with the server's reason
     are shown. The result is labelled a validated draft, not published.
   - Enter the Driver's user ID (no driver directory exists), Apply to all trips, Publish.
     Reload: the same "Effective published" revision.
   - Driver user ID: `docker compose exec postgres psql -U waypoint -d waypoint_acceptance -Atc "select id from users where email='driver@waypoint.demo'"`.
3. **Loader** (Android): sign in -> Today shows the published trips -> open the van trip.
   Mark one order Loaded, the other Problem -> Missing with a note -> Mark ready -> READY.
   Load the truck trip and mark it ready.
4. **Driver** (Android, on the delivery date): Today -> van trip READY -> Start -> Arrive -> proof
   (receiver + photo) -> Deliver -> Complete. Truck trip: Start -> Could not deliver (Outlet closed + note)
   -> Complete.
5. **Store**: the delivered order reads "Delivered · confirm receipt" -> Confirm receipt.
   The failed-stop order stays "Out for delivery" (no failed status for Stores), the missing one
   "Loading", the oversized one "Deferred"; none offers a receipt.
6. **Dispatcher** -> Trips: both trips Completed, 1 delivered and 1 failed stop, exceptions "Missing at
   loading" and "Delivery failed" with notes, 1 receipt confirmed, and the audit log from PLAN_PUBLISHED to
   RECEIPT_CONFIRMED.

Offline demo (Loader or Driver): enable airplane mode, record the actions (shown as "Saved on phone ·
waiting to sync"), kill and relaunch the app, disable airplane mode. Each action is applied once.

## 9. Synthetic data and unsupported features

- Travel times are **synthetic** in the Dispatcher UI and the scenario (6 km/15 min depot legs,
  3 km/10 min between outlets, 10 min service) and are labelled so in the request, the results and audit.
  No road-data source, map, ETA or GPS exists.
- Not supported (shown as unavailable or removed):
  - account and data management: password reset, biometric/NFC sign-in, a driver directory
    (enter the user ID), excluding single orders from optimization, republish, re-plan or
    exception resolution, exports;
  - figures: forecasts, utilisation, SLA metrics;
  - Store: notifications, and a failed-delivery status (failed-stop orders read "Out for delivery");
  - partial deliveries, carton counts, signatures.
- Prototype screens still showing static design data and not on the demo path:
  - Loader: `flows`, `dialogs`, `choose-depot`;
  - Driver: `next-stop-*`, `trip-complete`, `photo-attention` and the offline-failure screens.
- The Driver typecheck has existing `TurnByTurnCard` icon errors (not on the demo path).
