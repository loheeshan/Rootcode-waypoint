# Receipts

Store Manager confirmation that a delivered order was received. Contract:
[API contract](../../../../docs/architecture/API-CONTRACTS.md#receipt-confirmation);
storage: [data model](../../../../docs/architecture/DATA-MODEL.md#receipt-confirmations).

- `models.py`: `ReceiptConfirmation`, one per order, keyed by the client request UUID
  and linked to the Driver's `DELIVERED` event.
- `service.py`: outlet scope through `user_outlets` in SQL, order row lock,
  replay/conflict handling and the `DELIVERED -> RECEIPT_CONFIRMED` transition.
- `router.py`: `STORE_MANAGER` POST/GET at `/api/v1/store/orders/{order_id}/receipt`.

Only orders delivered at a stop with a recorded `DELIVERED` event can be confirmed;
orders from failed stops stay `OUT_FOR_DELIVERY` and are rejected. No discrepancy
fields exist because the specifications define none.

Tests: `tests/test_receipts_api.py` (PostgreSQL concurrency tests skip under SQLite).
Apply migrations with `docker compose exec api alembic upgrade head` (expected head
`0012_receipt_confirmations`).
