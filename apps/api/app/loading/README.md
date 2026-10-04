# Loading

Loader backend workflow for trips of each plan's effective published revision.
Endpoints, request/response fields and status codes are in the
[API contract](../../../../docs/architecture/API-CONTRACTS.md#loader); storage is in
the [data model](../../../../docs/architecture/DATA-MODEL.md#loading-events-and-readiness).

- `models.py`: append-only `LoadEvent` rows (client event UUID, per-trip sequence,
  `LOADED`/`MISSING`/`DAMAGED`, exception note) and `TripLoadingCompletion`.
- `service.py`: depot scope in SQL (`user_depots` joined to the plan), effective
  publication join, trip row locks, replay/conflict handling and readiness rules.
- `router.py`: `LOADER`-only routes mounted under `/api/v1`.

Loading is per order because orders have no item lines or quantities. The latest
event per order is its current outcome. The first event moves the trip to `LOADING`
and its planned orders to `LOADING`. Ready requires every served order to have an
outcome, at least one `LOADED`, and the caller's `last_event_sequence` to equal the
latest sequence. `READY` is final for loading.

Offline clients should create the event UUID once, store it with the pending event
and resend the identical payload until a 200/201 arrives; 409 means a different
payload already used that ID or loading is finalized. Mobile SQLite/outbox storage
and batched sync ingestion belong to the offline-sync batch.

Tests: `tests/test_loading_api.py`. Its PostgreSQL concurrency tests skip under
SQLite; run them against a disposable PostgreSQL database. Apply migrations with
`docker compose exec api alembic upgrade head` (expected head `0010_load_events`).
