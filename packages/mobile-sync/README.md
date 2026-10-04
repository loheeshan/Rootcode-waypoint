# @waypoint/mobile-sync

Durable outbox for the Loader and Driver apps (`POST /api/v1/sync/events`).

- `Outbox.migrate(db)` creates `sync_outbox` (immutable event rows, per account) and `sync_meta`.
- `add(userId, event)` stores an event as `pending` before the UI calls it saved.
- `sync(userId, send)` sends due events oldest first in batches of at most 50 and applies each
  result: `APPLIED`/`DUPLICATE` -> `synced`; `REJECTED`/`CONFLICT` -> `failed` (needs attention,
  never resent automatically); `RETRY` and network/server failures -> `pending` with bounded
  backoff (2 s doubling to 5 min); `SKIPPED` -> `pending`. 401/403 stop the run and keep events.
- Within a trip nothing is sent while an earlier event is waiting or failed.
- `recover()` on start turns interrupted `syncing` rows back into `pending`.

The package has no Expo imports: each app passes its own `expo-sqlite` database (the apps use
different Expo SDKs). Tests run the real SQL on Node's built-in `node:sqlite`.
