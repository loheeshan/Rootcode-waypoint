# Audit and live operations

- `app/audit/models.py`: append-only `AuditEvent` with a unique dedupe key.
- `app/audit/service.py`: `record_audit` adds a row to the caller's transaction; the
  publication, loading, delivery, POD, receipt and sync services call it only on the
  path that creates a new domain record, so replays never add entries.
- `app/operations/`: Dispatcher-only `GET /api/v1/operations/{live,trips,exceptions,audit}`,
  scoped to current `user_depots` in SQL and derived from authoritative rows.

Contract: [live operations and audit](../../../../docs/architecture/API-CONTRACTS.md#live-operations-and-audit).
Storage: [audit history](../../../../docs/architecture/DATA-MODEL.md#audit-history).
Never put credentials, tokens, POD bytes or receiver names in `details`.

Tests: `tests/test_operations_api.py`. Expected migration head: `0014_audit_events`.
