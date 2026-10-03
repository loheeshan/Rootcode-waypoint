# Planning

`models.py` and migration `0005_planning_foundation` add four storage tables:

- `plans`: one workspace per depot and delivery date, with its creator and status.
- `plan_revisions`: numbered alternatives belonging to a plan.
- `trips`: a revision's vehicle trips, with an optional assigned driver.
- `trip_stops`: ordered outlet visits with an optional planned arrival timestamp.

All four models are registered in `app/db/models.py`. No planning endpoints are
mounted yet. Order assignments, deferral decisions, optimizer inputs/results,
authorization and publishing are separate increments.

## Storage decisions

A plan is depot-scoped to match Dispatcher assignments. A unique depot/date pair
provides one workspace for that day; re-planning adds a revision instead of a
second plan. The plan and its revisions use `DRAFT`/`PUBLISHED`. A revision requires
a positive, unique number within its plan. Only a published revision has a
non-null `published_at`. The intended plan status summarizes whether anything
has been published; it does not replace the status of each revision. Synchronizing
that summary and selecting the current published revision need the publish service.

Each revision allows trip slots 1 and 2 per vehicle, unique by revision, vehicle
and slot. Alternative revisions may reuse those slots. This does **not** enforce
the operational two-trips-per-vehicle/day limit across published revisions or
other depot plans. The later publisher/validator must select one effective
revision and check the complete day's work, including concurrent publishing.

A trip can be saved without a driver while being planned. `driver_id` references
an existing user and is indexed for assigned-trip queries; role, active status,
depot scope and Driver endpoint access must be checked by future services.
Trip statuses match the existing shared contract: `PLANNED`, `LOADING`, `READY`,
`IN_PROGRESS`, `COMPLETED`.

Stops have a positive sequence number and one visit per outlet per trip. Another
trip may visit the same outlet. Sequence numbers need not be contiguous in storage;
the optimizer/validator will produce the final ordering. `planned_arrival_time`
is a nullable PostgreSQL timestamp **with date and timezone**, allowing overnight
routes; null means the arrival has not yet been calculated. Outlet windows remain
local Asia/Colombo clock times. Stop states are `PLANNED`, `ARRIVED`, `DELIVERED`,
`FAILED`; transitions and failure evidence are future delivery workflow work.

All planning foreign keys use `RESTRICT`. Deleting a referenced plan, revision,
trip, creator, assigned driver, vehicle, outlet or depot is rejected. Parent ORM
relationships preserve that behavior even with children loaded. Explicitly
deleting children before parents remains possible in trusted database code.
These constraints protect references; they do not make published data immutable.
Future publish/edit services must enforce immutable published revisions and new
revision creation for edits. No public API can write these records yet.

## Apply the migration

From `D:\Rootcode` after committing the increment:

```powershell
docker compose up -d --build --wait api
docker compose exec api alembic upgrade head
docker compose exec api alembic current
docker compose exec api alembic check
```

Expected head: `0005_planning_foundation`. The migration creates only these four
empty tables and their indexes; all nine earlier tables, records, roles and scope
assignments remain intact. It inserts no plans or trips. Existing demo seeds keep
their previous behavior.

Local Python, from `apps/api`: `uv sync --frozen`, then `uv run alembic upgrade head`.
Run `uv run ruff check .`, `uv run mypy app` and `uv run pytest -q` for backend checks.
`tests/test_planning_schema.py` covers constraints, defaults, foreign keys, loaded
ORM deletion behavior, old-data preservation and migration rollback/reapply.
Model/migration parity is also checked by the existing identity schema test.

Downgrading to `0004_user_scopes` removes all four planning tables and their data,
while retaining earlier tables. Test rollback only in a disposable database.

See the [data model](../../../../docs/architecture/DATA-MODEL.md#planning-foundation)
for fields. Capacity, temperature/access compatibility, home depot, delivery
windows, fuel, availability, served/deferred accounting, driver authorization and
publication immutability still require services and validation before publishing.
