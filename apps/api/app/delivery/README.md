# Delivery

Driver backend workflow for the assigned Driver's trips in a plan's effective
published revision. Endpoints and rules are in the
[API contract](../../../../docs/architecture/API-CONTRACTS.md#driver); storage is in
the [data model](../../../../docs/architecture/DATA-MODEL.md#delivery-events-and-proof-of-delivery).

- `models.py`: append-only `DeliveryEvent` (client event UUID, per-trip sequence)
  and `ProofOfDelivery` (JPEG/PNG bytes up to 1 MB, SHA-256, receiver name).
- `service.py`: assigned-Driver/depot scope, trip/stop row locks, replay/conflict
  handling, transitions and order status updates.
- `router.py`: `DRIVER` routes; POD photo reads also allow depot Dispatchers.

Flow: `start` (trip `READY`) -> per stop `arrive` -> `pod` -> `deliver`, or `fail`
with a reason and note -> `complete` once every stop with loaded orders has an
outcome. Only orders whose final loading outcome is `LOADED` are delivered;
failed stops keep their orders `OUT_FOR_DELIVERY`, never `DELIVERED`.

Offline clients should create each event/POD UUID once, store it with the queued
payload and resend it unchanged until 200/201. The general sync endpoint and mobile
outbox belong to the offline-sync batch.

Tests: `tests/test_delivery_api.py`. Its PostgreSQL concurrency tests skip under
SQLite; run them on a disposable PostgreSQL database. Apply migrations with
`docker compose exec api alembic upgrade head` (expected head `0011_delivery_events`).
