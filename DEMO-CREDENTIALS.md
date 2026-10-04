# Waypoint demo: credentials and guided check

> **Demo only, not production.** The password below is a shared, demo-only value seeded into a
> throwaway Docker database. Never reuse it, and never run demo mode against real data.

## Start

```bash
docker compose up            # from a fresh clone; no .env file needed
```

- First start builds the images: about 5–10 minutes. Later starts take about 1 minute.
- **Ready** when the log shows `=== Waypoint demo is ready ===` (from the `demo-ready` service).
- The API container logs what it seeded, prefixed `[demo]`: accounts, resources and today's plan.
- Ports used: 3000 (web), 8000 (API), 8081/8082 (Metro), 127.0.0.1:5432 (PostgreSQL).
  If one is busy, set `WEB_PORT`, `API_PORT` or `POSTGRES_PORT` before `docker compose up`.

## URLs

| What | URL |
|---|---|
| Store web | http://localhost:3000/store |
| Dispatcher web | http://localhost:3000/dispatcher |
| API docs | http://localhost:8000/docs |
| Loader app (Metro) | `exp://<host>:8082`, printed in the `loader-metro` log |
| Driver app (Metro) | `exp://<host>:8081`, printed in the `driver-metro` log |

## Accounts (one shared demo password)

| Role | App | Where to sign in | Email | Password | What to try first |
|---|---|---|---|---|---|
| Store Manager | Web | http://localhost:3000/store | `store@waypoint.demo` | `WaypointDemo#2026` | My orders: delivered, deferred and out-for-delivery orders. Confirm the receipt of the order marked "Delivered · confirm receipt". |
| Dispatcher | Web | http://localhost:3000/dispatcher | `dispatcher@waypoint.demo` | `WaypointDemo#2026` | Planning (today's published plan, served and deferred), then Trips (live operations, exceptions, audit log). |
| Loader | Loader app (Expo Go SDK 57) | Sign-in screen | `loader@waypoint.demo` | `WaypointDemo#2026` | Open the trip that is not loaded yet: record Loaded and Missing (with a note), then Mark ready. |
| Driver | Driver app (Expo Go SDK 56) | Sign-in screen | `driver@waypoint.demo` | `WaypointDemo#2026` | Start the READY trip, arrive, take the proof photo, deliver, complete. |

Every sign-in screen shows a **Demo account** card with **Use demo account**, which fills both
fields. Sign-in still goes through the API; nothing is bypassed. The card appears only in this
Docker demo (`APP_ENV=demo`).

## What is seeded automatically

All created through the real backend services on start, for **today's Colombo date** (UTC+05:30):

- **One published plan with 4 trips**, all assigned to the demo Driver.
  - A van trip delivered with proof: one order missing at loading; one receipt confirmed, one delivered order still awaiting its receipt.
  - A van trip **READY** for the Driver.
  - A truck trip whose stop **failed** (outlet closed, with a note).
  - A truck trip **published but not loaded**, for the Loader.
- **One deferred order** (too large for any vehicle), with the server's reason.
- **One Store order for a future date** (status Confirmed).
- Demo-only additions, for transparency:
  - Today's orders belong to a demo-only, all-day outlet, "Waypoint Demo Express (24h demo outlet)", so a same-day route fits whenever you start the stack.
  - They are inserted as Confirmed orders, because the Store API accepts future dates only.
  - Missing fuel totals for this week are recorded as 0 L.
  - Travel times are synthetic and labelled so.
- **Late start:** if the stack starts after about 19:30 Colombo time, a same-day route no longer fits. The next date the Store would accept is planned instead: published, one trip READY, nothing started. Trips can only start on their delivery date. The `[demo]` log line says which date was used.
- Restarting `docker compose up` never duplicates data.

## Mobile apps (Expo Go)

1. Install **Expo Go** that matches each app's SDK: **Loader = SDK 57**, **Driver = SDK 56**.
   - Emulator: run `npx expo start --android --go` once inside `apps/loader-mobile` or
     `apps/driver-mobile`; it installs the right Expo Go build.
   - Phone: get the Expo Go build for that SDK from https://expo.dev/go.
2. Open the app with the `exp://` URL from the logs:
   - see the URLs with `docker compose logs loader-metro driver-metro`;
   - **Android emulator** (default, `DEMO_HOST_IP=10.0.2.2`):
     `adb shell am start -a android.intent.action.VIEW -d exp://10.0.2.2:8082` (Loader) or
     `... -d exp://10.0.2.2:8081` (Driver);
   - **Physical phone** on the same Wi-Fi: start with your computer's LAN IP, e.g.
     `DEMO_HOST_IP=192.168.1.20 docker compose up` (PowerShell: `$env:DEMO_HOST_IP='192.168.1.20'; docker compose up`).
     Allow inbound TCP 8000, 8081 and 8082 in the firewall, then enter `exp://192.168.1.20:8082` or `:8081` in Expo Go.
3. The apps call the API at `http://<DEMO_HOST_IP>:8000/api/v1`. The emulator default is `http://10.0.2.2:8000/api/v1`.
4. **Driver proof of delivery** needs camera permission. Allow it when asked; denying it shows how the app handles it.
5. **If Metro inside Docker does not work** on your machine, run the apps on the host instead:
   - `docker compose stop loader-metro driver-metro`;
   - set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_DEMO_MODE=true` and `EXPO_PUBLIC_DEMO_PASSWORD=WaypointDemo#2026`
     in `apps/loader-mobile/.env` and `apps/driver-mobile/.env`;
   - run `corepack pnpm install`, then `corepack pnpm dev:loader` and `corepack pnpm dev:driver`, and press `a`.

## Guided check (about 15 minutes)

Trips can only start on their delivery date and new Store orders are for future dates, so the
Driver steps use today's seeded READY trip.

1. **Store** (`/store`): Use demo account → New order (any weight, tomorrow's date) → Submit.
   Note the order ID and the accepted date (after 16:00 Colombo it moves one more day).
2. **Dispatcher** (`/dispatcher`): set the top-bar date to that accepted date → Orders: your order is listed.
3. **Dispatcher** → Fleet inputs: mark both vehicles **Available** for that date.
4. **Dispatcher** → Planning: Create plan workspace → Run optimization. Check served trips, stop
   sequence, weight/volume per trip and any deferral reason. Results are labelled synthetic.
5. **Dispatcher**: enter the Driver's user ID (`docker compose exec postgres psql -U waypoint -d waypoint
   -Atc "select id from users where email='driver@waypoint.demo'"`) → Apply to all trips → Publish.
   Reload: the same revision is "Effective published".
6. **Loader** (app): Today shows the new trip and today's trips. On today's not-loaded trip, record
   one order Loaded and, if there are two, one Missing with a note → Mark ready → READY.
7. **Driver** (app): Today → the READY trip → Start → Arrive → proof (receiver + photo) → Deliver → Complete.
8. **Store**: the order you just delivered reads "Delivered · confirm receipt" → Confirm receipt.
9. **Dispatcher** → Trips (today): trip statuses, loading exceptions, delivered and failed stops,
   receipts confirmed.
10. **Dispatcher** → Trips → Audit log: PLAN_PUBLISHED, LOAD_RECORDED, TRIP_READY, TRIP_STARTED,
    POD_UPLOADED, STOP_DELIVERED, RECEIPT_CONFIRMED for the same trip IDs.

**Offline test** (Loader or Driver):
1. Turn on airplane mode on the phone or emulator (`adb shell cmd connectivity airplane-mode enable`).
2. Record actions; they show "Saved on phone · waiting to sync".
3. Kill and reopen the app: the actions are still there.
4. Turn airplane mode off (`... airplane-mode disable`). Each action is applied once, and the Dispatcher sees it.

## Reset

```bash
docker compose down -v       # deletes the demo database and generated key (demo volumes only)
docker compose up            # fresh demo data for today
```
