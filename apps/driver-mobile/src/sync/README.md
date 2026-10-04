# Driver offline sync

Built on `@waypoint/mobile-sync` (`packages/mobile-sync`), like the Loader (`apps/loader-mobile/src/sync`).

- Start, arrive, fail, deliver and complete are stored in SQLite (`sync_outbox`) with a UUID and fixed
  payload before the screen shows them, and sent through `POST /sync/events` (`driverSync.ts`).
- Deliver: the proof (receiver, photo file, `pod_id`) is kept in `driver_deliver_intents`, and
  `STOP_DELIVERED` is queued at once so actions stay in order. Each sync uploads pending proofs first
  (`POST .../pod`, idempotent by `pod_id`); while a proof cannot be uploaded for a network/server
  reason, nothing is sent, so a delivery never reaches the server before its proof. The server
  accepts a proof only after the arrival: when start/arrive were also recorded offline, the 409 is
  not a rejection; the queue is sent without that delivery and the later events of its trip (held
  locally as RETRY), the proof is uploaded, then the delivery is sent in the same pass. The photo is
  deleted once the server has it.
- Screens show the cached server trip with unsent actions applied (`features/driving/overlay.ts`),
  labelled "waiting to sync". Start is offered only when the server copy says READY.
- Rejected/conflicting actions are listed on Stops with the server's reason and a Discard action;
  later actions for that trip wait. 401 asks for sign-in, 403 pauses.
- Account policy: rows carry the user ID; sign-out keeps unsent work for that account only. Each sync
  run sends only with the token it started with.
