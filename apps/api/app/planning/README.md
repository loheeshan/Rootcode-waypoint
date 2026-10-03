# Planning

`models.py` and migration `0005_planning_foundation` add four storage tables:

- `plans`: one workspace per depot and delivery date, with its creator and status.
- `plan_revisions`: numbered alternatives belonging to a plan.
- `trips`: a revision's vehicle trips, with an optional assigned driver.
- `trip_stops`: ordered outlet visits with an optional planned arrival timestamp.

`assignment_models.py` and migration `0006_plan_outcomes` add `plan_assignments`
and `deferral_decisions`. All six models are registered in `app/db/models.py`.
No planning endpoints are mounted yet. Allocation, authorization and publishing
services remain separate increments.

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

## Order assignments and deferrals

`plan_assignments` is the canonical result for an order in one revision. A unique
`(plan_revision_id, order_id)` prevents two results for that order/revision, even
if one is served and one is deferred. Another revision can hold a different result.

- `SERVED` requires both `trip_id` and `trip_stop_id`. This means assigned for
  delivery in the plan; it does not mean the delivery has happened.
- `DEFERRED` requires both route references to be null. It can have one primary
  `deferral_decisions` row with a reason code and explanation.

The assignment stores `outlet_id` alongside its order. Composite foreign keys
check that the outlet matches the order, the trip belongs to the assignment's
revision, and the stop belongs to that trip and outlet. Multiple orders can share
a stop. Three unique indexes on existing order/trip/stop reference columns support
these checks; no existing columns or records are rewritten. Updating referenced
parent columns to combinations that invalidate an assignment is also blocked.

Deferral rows reference an assignment's revision, order and `DEFERRED` outcome.
Their `assignment_outcome` column is an internal checked discriminator, always
`DEFERRED`. This prevents reasons for served results, nonexistent outcomes or the
wrong order/revision. One primary reason is allowed per deferred result. The nine
`DeferralReason` codes match the supplied architecture document and shared types:

```text
NO_COMPATIBLE_VEHICLE
REEFER_CAPACITY_EXHAUSTED
VAN_CAPACITY_EXHAUSTED
WEIGHT_CAPACITY
VOLUME_CAPACITY
TIME_WINDOW
FUEL_QUOTA
VEHICLE_UNAVAILABLE
TRIP_LIMIT
```

`reason_text` is required, at most 1,000 characters, and cannot contain only
spaces, tabs or line breaks. Both tables receive UUIDs from the application and
timezone-aware database creation timestamps. Outcomes/reasons do not change the
live `orders.status`; publishing will manage those transitions.

Writes use explicit assignment IDs (`plan_revision_id`, `order_id`, `outlet_id`,
`trip_id`, `trip_stop_id`); its revision/order/trip/stop ORM navigation is view-only
so overlapping composite relationships cannot rewrite these IDs. A deferred
assignment can be added together with `deferral=DeferralDecision(...)` in one
transaction. A reason prevents deleting or switching its assignment to served
until the reason is explicitly removed, including with ORM relationships loaded.
All new references use `RESTRICT`; removing results never deletes orders or routes.

A draft deferred assignment can temporarily exist without a reason. A later
atomic result writer/publisher must require one explanation for every deferred
order and exactly one result for every selected order. The database guarantees
**at most one**, not complete coverage. Depot/date eligibility, physical planning
constraints, current publication selection, and published immutability still
require validation. No results are seeded or exposed through new public routes.

## Apply the migration

From `D:\Rootcode` after committing the increment:

```powershell
docker compose up -d --build --wait api
docker compose exec api alembic upgrade head
docker compose exec api alembic current
docker compose exec api alembic check
```

Expected head: `0006_plan_outcomes`. The newest migration creates two empty tables
and three supporting parent indexes; all 13 earlier tables and their records are
preserved. The earlier `0005` migration created the four planning foundation
tables. Neither migration inserts planning data. Demo seeds keep their previous
behavior.

Local Python, from `apps/api`: `uv sync --frozen`, then `uv run alembic upgrade head`.
Run `uv run ruff check .`, `uv run mypy app` and `uv run pytest -q` for backend checks.
`tests/test_planning_schema.py` covers constraints, defaults, foreign keys, loaded
ORM deletion behavior, old-data preservation and migration rollback/reapply.
Model/migration parity is also checked by the existing identity schema test.
`tests/test_plan_outcomes_schema.py` checks outcome exclusivity, composite
references, all reason codes, partial-null rejection, preservation of all 13
earlier tables and rollback/reapply with supporting-index cleanup.

Downgrading from `0006` to `0005_planning_foundation` removes outcome/reason data
and the three supporting indexes while retaining plans, trips, stops and earlier
records. Downgrading further to `0004_user_scopes` also removes the four planning
foundation tables. Test rollback only in a disposable database.

See the [data model](../../../../docs/architecture/DATA-MODEL.md#planning-foundation)
for fields. Capacity, temperature/access compatibility, home depot, delivery
windows, fuel, availability, served/deferred accounting, driver authorization and
publication immutability still require services and validation before publishing.
