# Sync

Batch replay of queued Driver/Loader events. Contract and client guidance:
[API contract](../../../../docs/architecture/API-CONTRACTS.md#offline-synchronization);
storage: [data model](../../../../docs/architecture/DATA-MODEL.md#sync-receipts).

- `schemas.py`: batch envelope (1-50 events), per-event envelope and outcomes.
- `service.py`: maps each type to the existing loading/delivery service, validates the
  payload with that service's request model, compares the stored receipt hash, and
  passes a `before_commit` hook so the `sync_events` receipt commits with the change.
- `models.py`: `SyncEvent` receipts.

No business rule is duplicated here: role, scope, assignment, readiness and POD
checks run inside the domain services on every event, including replays. Events are
processed in order, one transaction each; after a failure, later events of the same
trip in that batch are `SKIPPED`.

Tests: `tests/test_sync_api.py` (PostgreSQL concurrency tests skip under SQLite).
Expected migration head: `0013_sync_events`.
