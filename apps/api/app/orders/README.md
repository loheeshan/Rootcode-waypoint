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

The order table was introduced at `0003_orders`; current head is `0004_user_scopes`.
This API increment adds no migration. The order migration preserves existing users,
roles, depots, outlets and vehicles, and inserts no sample orders. Downgrading
to `0002_fleet_foundation` deletes the order table and its data; use disposable
databases for rollback testing.

`apps/api/tests/test_order_schema.py` runs the real migration, checks constraints
and shared status values, and verifies rollback/reapply preserves earlier data.
Run backend checks from `apps/api` with `uv run ruff check .`, `uv run mypy app`,
and `uv run pytest -q`.

## Store order API

- `POST /api/v1/store/orders`: creates a `CONFIRMED` order for an assigned outlet.
- `GET /api/v1/store/orders`: filters and paginates only the user's outlet orders.
- `GET /api/v1/store/orders/{order_id}`: returns an accessible order, otherwise 404.

All three require the `STORE_MANAGER` role and active bearer authentication.
Create and explicit outlet filters require an exact assignment. List totals,
pagination and detail lookups apply outlet access in SQL. Scope revocation takes
effect on the next request. Other roles cannot use these Store routes.

Input validation rejects extra/server-owned fields, invalid dates/temperature,
nonfinite or nonpositive quantities, quantities at or above 1 billion, and
values requiring more than three decimal places. Response quantities are fixed
three-decimal strings. `created_at` is returned in UTC.

The server applies a 16:00 Asia/Colombo cutoff. A request for tomorrow submitted
at or after 16:00 moves to the day after tomorrow. Later dates stay unchanged;
same-day/past requests are rejected. In the absence of a specified operating
calendar, every calendar day is eligible. `tzdata` is an explicit dependency so
the named timezone works on Windows and minimal containers.

The existing `requested_delivery_date` column stores the accepted date after
cutoff adjustment. The POST response wraps the order with the original input
(`submitted_delivery_date`) and a `cutoff_applied` flag so the UI can explain the
change. Those two submission fields are response metadata, not persisted history.
Clients should show the returned accepted date. `CONFIRMED` means the order was
accepted for planning, not that routing/vehicle constraints have been solved.

Create returns 201 with a Location header. List supports `outlet_id`, `status`,
`requested_delivery_date`, `limit` (1–100, default 20) and nonnegative `offset`.
Detail hides other outlets' order IDs using the same 404 as an unknown ID.
Successful responses are not cached. Failed writes roll back; database details
are not included in errors. Each successful POST creates a separate order;
automatic retry/idempotency and later status transitions are not implemented.

For local verification, run both [demo seeds](../fleet/README.md#synthetic-demo-data),
configure the signing key, and log in as `store@waypoint.demo` in `/docs`.
Authorize with the returned token, take `outlet_ids[0]` from `/me`, submit a future
order, then list orders and retrieve the returned ID. Use a fresh future date
when testing; the server clock determines the cutoff.

See the [exact JSON contract](../../../../docs/architecture/API-CONTRACTS.md#store-manager).
`tests/test_store_orders_api.py` covers role/outlet isolation, cutoff boundaries,
validation, filtering, stable tie ordering, and failed-write rollback. Frontend
wiring, receipts and status transitions remain pending.

## Dispatcher order queue

`GET /api/v1/dispatcher/orders` requires `DISPATCHER`. It lists orders whose
outlets belong to currently assigned depots, independent of Store outlet grants.
Items include the Store order fields plus nested `outlet` (delivery constraints)
and `depot` (ID/name). Order quantities stay three-decimal strings; timestamps
are UTC, while outlet window times are local Asia/Colombo times.

Optional filters: `depot_id`, `outlet_id`, `status`, `requested_delivery_date`.
Use `status=CONFIRMED` for the confirmed queue; omitting status includes all
statuses. Date filters match the accepted date after the Store cutoff. Pagination
uses `limit` (1–100, default 20) and nonnegative `offset`. Access is applied in SQL
before counting or pagination; rows sort by creation time then UUID descending.
Unknown/foreign explicit depot/outlet filters receive 403. No assignments or no
matches return an empty list. The endpoint is read-only; it does not allocate,
defer, publish, or update order statuses. No new migration is required.

To verify the Store-to-Dispatcher flow, create an order as the demo Store Manager,
then authorize as the demo Dispatcher. Filter the queue by `status=CONFIRMED` and
the creation response's accepted `requested_delivery_date`; the same order ID
and quantities should appear with its outlet and depot details. The demo resource
seed gives these two accounts the corresponding outlet/depot scopes.

See the [Dispatcher contract](../../../../docs/architecture/API-CONTRACTS.md#dispatcher-order-queue).
`tests/test_dispatcher_api.py` covers this flow, current depot access, scoped
counts/metadata, revoked permissions, filters, pagination and read errors.
