# Loader offline sync

Built on `@waypoint/mobile-sync` (`packages/mobile-sync`).

- Every loading change is stored in SQLite (`sync_outbox`, status `pending`) with a UUID and fixed
  payload before the screen calls it saved. The checklist shows the server copy with unsent changes
  applied on top (`features/loading/overlay.ts`).
- `SyncProvider` sends the queue on sign-in, on an offline -> online change, when the app returns to
  the foreground, after each change, and on a backoff timer (2 s doubling to 5 min).
- "Mark trip ready" stores a request (`loader_ready_requests`). Only after every load event of that
  trip is acknowledged does `loaderSync.ts` read the trip from the server and queue `TRIP_READY` with
  the server's `last_event_sequence`. READY is shown only from the server copy.
- Rejected or conflicting changes are listed on the checklist with the server's reason; later changes
  for that trip wait until the loader discards them. A rejected ready request is shown on Depart and
  removed from the queue, so the trip can be marked ready again.
- Account policy: all rows carry the user ID. Signing out keeps unsent changes on the phone for that
  account only; another account never sees or sends them. Each run sends only with the token it
  started with. 401 asks for sign-in, 403 pauses with "no longer has Loader access".
