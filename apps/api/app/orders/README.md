# orders

`models.py` defines `Order`, `OrderStatus`, and `TemperatureRequirement`.
Migration `0003_orders` follows `0002_fleet_foundation` and creates the order
table, its constraints, and indexes on outlet and requested delivery date.

Orders reference an existing outlet, require positive finite weight and volume,
and use the seven shared order statuses. New rows default to `CONFIRMED` and
receive a creation timestamp. See the [data model](../../../../docs/architecture/DATA-MODEL.md)
for exact fields and limits.

Apply and verify in the existing Docker setup:

```powershell
Set-Location D:\Rootcode
docker compose up -d --build --wait api
docker compose exec api alembic upgrade head
docker compose exec api alembic current
docker compose exec api alembic check
```

Expected revision at this increment: `0003_orders (head)`, with no new upgrade
operations reported by `alembic check`. The migration preserves existing users,
roles, depots, outlets and vehicles, and inserts no sample orders. Downgrading
to `0002_fleet_foundation` deletes the order table and its data; use disposable
databases for rollback testing.

`apps/api/tests/test_order_schema.py` runs the real migration, checks constraints
and shared status values, and verifies rollback/reapply preserves earlier data.
Run backend checks from `apps/api` with `uv run ruff check .`, `uv run mypy app`,
and `uv run pytest -q`.

Order submission, the 4 PM cutoff, authorization, and status-transition services
are pending. The [API contract](../../../../docs/architecture/API-CONTRACTS.md)
describes planned endpoints; none are mounted for orders yet.
