# Planning

`models.py` and migration `0005_planning_foundation` add four storage tables:

- `plans`: one workspace per depot and delivery date, with its creator and status.
- `plan_revisions`: numbered alternatives belonging to a plan.
- `trips`: a revision's vehicle trips, with an optional assigned driver.
- `trip_stops`: ordered outlet visits with an optional planned arrival timestamp.

`assignment_models.py` and migration `0006_plan_outcomes` add `plan_assignments`
and `deferral_decisions`. All six models are registered in `app/db/models.py`.
Dispatcher plan create/list/detail endpoints are implemented with depot scope
checks. A live compatibility preview checks individual orders against depot
vehicles. `allocation.py` implements the capacity-only CP-SAT core; `routing.py`
sequences fixed groups against imported travel, window and fuel inputs. The
optimization API, independent full-plan validation and publishing remain pending.

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
revision creation for edits. The current API can only create a new draft plan
with its initial empty revision; it cannot edit existing plans or outcomes.

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
require validation. No results are seeded. Plan detail exposes saved result
counts, not full assignments, stops, reason text or a validation verdict.

## Plan workspace API

- `POST /api/v1/plans`: accepts `depot_id` and `delivery_date`, creates a draft
  plan and revision 1 atomically, then returns 201 with a detail response.
- `GET /api/v1/plans`: depot-scoped discovery with optional depot/date/status
  filters and `limit`/`offset` pagination.
- `GET /api/v1/plans/{plan_id}`: metadata and revision history, including stored
  trip, served, deferred and unexplained-deferred counts per revision.

All require an active `DISPATCHER` bearer token. Any Dispatcher with the current
depot assignment may read the plan; the original creator is not a special access
boundary. Collections/totals and detail roots are scoped in SQL. Foreign and
missing plan IDs both return 404; create/explicit depot filters require a grant.

Use today or a future `YYYY-MM-DD` date in Asia/Colombo. Creating a plan does not
apply the Store cutoff or allocate orders. The server sets creator, statuses,
IDs and initial revision number. Extra/server-owned request fields are rejected.
A valid duplicate depot/date request returns 409 and the existing plan's Location,
including for concurrent requests. It never overwrites or adds revisions. CORS
exposes Location to the configured web origins. Other integrity failures return
a generic 409; database failures return a sanitized 503. Failed writes roll back.

Lists sort by delivery date then UUID descending; revisions by number ascending.
Counts use independent grouped queries to avoid multiplying trips and orders.
They report saved rows, not all selected orders or physical planning feasibility.
Detail permits historical plans and preexisting plans with no revisions. All
response timestamps are UTC and successful responses use `Cache-Control: no-store`.

After the demo seeds, authorize in `/docs` as `dispatcher@waypoint.demo`, take
`depot_ids[0]` from `/me`, and create a plan for the accepted delivery date from a
Store order. List and open the returned plan ID; revision 1 should be empty and
draft. A second identical request should return 409 pointing to that plan.
These routes require at least `0006_plan_outcomes`; apply the current migration
head shown below when updating the backend.
Tests in `tests/test_plans_api.py` cover scope/role revocation, concurrent creation,
atomic failures, filtering, counters, UTC responses and Colombo local-day boundaries.
See the [exact contract](../../../../docs/architecture/API-CONTRACTS.md#plan-workspaces).

## Compatibility preview

`GET /api/v1/plans/{plan_id}/compatibility?limit=20&offset=0` requires an active
Dispatcher and current access to the plan's depot. Missing/foreign plans both
return `404 Plan not found`. Only `CONFIRMED` orders with the plan's accepted
delivery date and current outlet depot are selected. Orders from other assigned
depots, other dates or other statuses are excluded before counting/pagination.

`compatibility.py` provides a deterministic engine using frozen input/result
dataclasses and Decimal comparisons. Inputs must have valid typed enums/UUIDs,
finite positive quantities and explicit boolean/unknown availability. Duplicate
order or vehicle IDs are rejected. Each whole order is checked independently;
orders are not split, assigned or deducted from shared vehicle capacity.

The response lists candidate IDs and every exclusion for each order, with
vehicle master data and exact-plan-day `is_available` (`true`, `false` or null).
Only explicit true permits a candidate. Yesterday's availability is not reused.
The engine checks all rules in this order:

| Issue | Exclusion |
|---|---|
| `DEPOT_MISMATCH` | Vehicle and outlet home depots differ (the API already selects one depot). |
| `TEMPERATURE_MISMATCH` | A chilled order requires a reefer; ambient orders may use either temperature type. |
| `VAN_REQUIRED` | A van-only outlet cannot use a truck. |
| `WEIGHT_CAPACITY` | The whole order exceeds the vehicle's weight limit. |
| `VOLUME_CAPACITY` | The whole order exceeds the vehicle's volume limit. |
| `VEHICLE_UNAVAILABLE` | Availability for that day is explicitly false. |
| `AVAILABILITY_UNKNOWN` | No availability is recorded for that day. |

Exact capacity equality is allowed; no floating-point rounding or tolerance is
used. Candidate and excluded vehicle lists are disjoint and cover all returned
vehicles for each order. These issues are **not persisted deferral reasons**.
Zero candidates can mean missing inputs; it does not mark an order deferred.

Pagination applies to orders only: default 20, range 1–100, nonnegative offset,
UUID ascending. `total` counts all eligible confirmed orders. The entire depot
vehicle set is returned on every page, also sorted by UUID. A depot with more
than 500 vehicles gets 422 rather than a truncated candidate set; the limit bounds
each response to at most 50,000 order/vehicle pairs. Empty order pages retain the
vehicle set; an empty fleet gives each order empty candidate/exclusion lists.

`is_complete_plan_validation` is always false. Two orders can each fit a vehicle
but exceed its combined capacity. Even a vehicle with zero fuel quota may pass
these individual checks because route distance/fuel is not evaluated here.
Combined loads, delivery windows, route sequencing/distance, weekly fuel usage
and reservations, two-trip/day limits, and full served/deferred coverage still
need allocation and an independent validator. No feasible-plan verdict is issued.

This is a live, advisory read, including for historical or published plans. It
does not read a saved revision's assignments or reproduce the inputs used when
that revision was created. Separate reads/pages can observe data changes; it is
not a consistent solver snapshot, reservation, or a source for publishing without
revalidation. No order status, trip, result, revision, availability or fuel row
is changed. Success uses `Cache-Control: no-store`; database errors return
`503 Compatibility preview unavailable` without SQL/connection details.

Use the fleet input API to mark a demo vehicle available for the **plan's date**,
then open the preview and inspect the candidate IDs/exclusions. Plan revision
counts remain unchanged. The frontend DTOs and full shape are in the
[compatibility contract](../../../../docs/architecture/API-CONTRACTS.md#plan-compatibility-preview).
Tests in `test_compatibility.py` exercise the engine's rules/boundaries; API tests
in `test_compatibility_api.py` check scope, exact-day inputs, status eligibility,
pagination, the vehicle limit, historical/published reads and absence of writes.
No migration is added; the current `0007_fleet_operations` head is required.

## Capacity allocation engine

`allocate_capacity(orders, vehicles, time_limit_seconds=5.0)` in `allocation.py`
accepts frozen compatibility inputs for one complete depot/day. It builds an
[OR-Tools CP-SAT](https://developers.google.com/optimization/cp/cp_solver) model
with integer units (kg and cubic metres multiplied by 1,000). It rejects excessive
precision instead of rounding. Quantities are positive and below 1,000,000,000,
matching the database's three-decimal limits.

The model assigns each whole order to at most one compatible vehicle/trip slot.
Each slot enforces **combined** weight and volume. Each vehicle has at most two
slots; an unused slot is empty. Chilled/reefer, van-only, depot and explicit-day
availability rules are reused from the compatibility engine. The objective first
maximizes the number of allocated orders, then minimizes nonempty trips. It does
not optimize weight, distance, revenue, priority or fairness among tied orders.

The immutable result contains vehicle/trip numbers, sorted order IDs and exact
load totals, plus every unallocated order ID. Together they cover the input set
exactly once. Trip numbers are contiguous from 1 for each vehicle; order IDs are
sorted for stable presentation, **not stop sequence**. These are temporary groups,
not database Trip IDs. No route or saved revision is created.

`OPTIMAL` means the capacity objective was proven optimal; `FEASIBLE` means a
capacity solution was found without proving optimality before the search ended.
Neither means a valid delivery route. `is_complete_plan_validation` is always
false. Unallocated IDs are not persisted business deferrals, and do not prove
that a particular order could never be allocated in a different solution.
No usable solver solution raises `AllocationUnavailable`; UNKNOWN, MODEL_INVALID
and INFEASIBLE are never converted into an empty successful plan.

Limits are 500 orders, 500 vehicles and 50,000 candidate assignment variables
(two per compatible order/vehicle pair); oversize inputs raise ValueError without
truncation. The solver uses one worker, a fixed seed and a five-second default
search limit; callers may set a positive limit up to 30 seconds. This bounds
solver search, not total Python/model construction time. Sorted inputs stabilize
the model; exact tie choices are not guaranteed across package versions or when
wall-clock limits interrupt search.

This engine has no HTTP endpoint yet and never reads or writes the database.
The caller must provide complete inputs for a single depot/day. Compatibility
preview pages must not be used as a complete allocation input. Travel/service
times, delivery windows and supplied weekly fuel balances are checked by the
separate scheduler below. Existing published work, authoritative reservation
loading, independent full-plan validation and result persistence remain future work.
The two-slot rule here applies only to this candidate allocation; publication
must also check all operational work for that vehicle/day.

`tests/test_allocation.py` checks overloaded days, both capacities, exact decimal
boundaries, scarce reefer use, empty/no-match inputs, restrictions and failure
statuses. A separate exhaustive enumerator compares small mixed-day optima and
independently recomputes capacity, compatibility, trip limits and exact coverage.
No dependency or migration changes are needed.

## Route scheduling and input import

`route_inputs.load_route_inputs(path)` imports a bounded JSON snapshot, validated
by frozen Pydantic models. The
[synthetic example](../../../../data/seed/route-inputs.synthetic.json) contains
invented development data explicitly approved for demonstration. It is independent
of existing database seeds; no IDs or fuel values are silently applied to live data.

The import is an internal file format, not an authenticated API or a database
import. Required snapshot fields are:

| Field | Meaning |
|---|---|
| `depot_id`, `delivery_date` | One intended depot/day; the future service must verify IDs, dates and depot scope against current database records. |
| `source`, `is_synthetic` | Required provenance label and boolean; both propagate to results. |
| `orders` | Complete order-to-outlet mapping, including capacity-unallocated orders. |
| `outlets` | Local Colombo open/close clock times and explicit per-visit service seconds. Mall restrictions use the same outlet window. |
| `legs` | Directed `from_outlet_id`/`to_outlet_id`, decimal `distance_km` and integer `travel_seconds`; null denotes the depot. |
| `vehicles` | Vehicle ID, timezone-aware earliest departure/latest return, turnaround seconds, explicitly available local dates, km/l and weekly fuel fields. |

Every directed pair among a trip's depot and outlet stops must exist. Reverse
legs, zero distances and travel times are never inferred. Extra fields, duplicate
IDs/legs, unknown outlet references, nonfinite/negative numbers and excessive
precision are rejected. An explicit zero-distance leg is allowed; positive
distance requires positive travel time. This is a static matrix shared by vehicles,
without traffic, vehicle-specific travel times or road restrictions beyond the
earlier compatibility checks. Service time is once per outlet visit, even when
that stop contains multiple orders. Those are current implementation assumptions.

`routing.schedule_capacity(allocation, inputs)` sequences the capacity engine's
fixed vehicle/order groups using CP-SAT circuits. It can reorder stops and swap
the two groups on one vehicle. It never splits or moves orders between groups.
It minimizes total route distance subject to these constraints:

- Each route starts and ends at the depot and visits each assigned outlet once.
- Early arrival waits until the outlet opens. The **entire service**, not just
  arrival, must finish by close. Equality at the close boundary is allowed.
- A close time before open means next-day close; the opening is anchored to the
  plan date. Window microseconds are preserved; travel/service inputs use seconds.
- The next trip starts after the previous depot return plus explicit turnaround.
  Both departures must be on the plan date. Following-day availability permits
  overnight service/return, not a second departure the following morning.
- Each route returns by the supplied deadline. Crossing midnight requires explicit
  following-day availability; otherwise return is capped at midnight. The horizon
  cannot exceed the end of the following day.
- Both trips share the vehicle's Monday-Sunday Colombo fuel budget. For each trip,
  fuel is distance divided by km/l, rounded **up** to 0.001 litre. Consumed fuel,
  existing reservations and the sum of candidate trip fuel must fit the quota.
  A vehicle cannot borrow another vehicle's balance. Negative remaining budget
  makes fixed groups infeasible, even if an individual trip would otherwise fit.

`fuel_used_l` and `fuel_reserved_l` are required, explicitly known aggregate inputs;
null means unknown and rejects scheduling for an allocated vehicle. Zero is valid
only when explicitly recorded. The snapshot's `fuel_week_start` must be the Monday
of the plan week. Horizons crossing into another fuel week are rejected until
separate week budgets are supported, including Sunday-night routes after midnight.
No fuel is consumed or reserved by this function. The future service must calculate
fresh consumed/reserved totals, exclude the candidate's own replacement reservation,
and avoid double-counting executed work. Publishing must lock and revalidate them.

Results contain chronological trip numbers, outlet stop sequence, order IDs,
actual arrival/service/departure/return times, distance and rounded fuel. Solver
slack is removed by reconstructing the earliest schedule along selected arcs.
Input groups and provenance remain untouched. Order coverage is checked before
solving: every snapshot order belongs to exactly one group or the capacity
unallocated list, with at most two nonempty groups per vehicle.

`OPTIMAL` proves minimum distance for these fixed groups; `FEASIBLE` does not prove
minimum distance. `INFEASIBLE` returns no trips and every grouped order under
`unscheduled_order_ids`; preexisting `unallocated_order_ids` stay separate. Neither
list is a stored business deferral. Missing inputs raise `RouteInputError`; UNKNOWN
or MODEL_INVALID raises `RouteSearchUnavailable`, never an infeasibility verdict.

**The future optimizer must repair or reallocate infeasible capacity groups.**
The capacity solver's trip-minimization objective can pack orders together that
need separate trips to satisfy windows. Failure here does not prove the orders
cannot be served in another allocation. The scheduler also trusts the earlier
capacity/compatibility stage and the supplied snapshot; it is not the independent
full-plan validator. Every result keeps `is_complete_plan_validation: false`.
There is no optimize endpoint, saved revision, driver assignment, operational
trip ledger check or publication in this increment.

Limits: 10 MB import, 500 orders/outlets/vehicles, 50,000 input legs, 25 unique
outlet stops per trip, 20,000 solver arcs. Oversize inputs fail without truncation.
Each leg is below 1,000,000 km with up to three decimal places; duration/service/
turnaround is an integer from 0 to 172,800 seconds. Search defaults to five seconds,
allows a positive limit up to 30 seconds, uses one worker and a fixed seed. That
limit covers search, not import/model construction. Exact tie choices can vary
between dependency versions or when wall-clock limits stop search.

`tests/test_routing.py` independently recomputes timelines, coverage, fuel and
return/turnaround constraints, compares small routes with exhaustive permutations,
and covers missing/invalid data, infeasible groups, overnight restrictions, fuel
rounding, numeric limits, solver statuses and the approved synthetic example.
No migration, dependency or HTTP/shared-TypeScript contract changes are needed.

## Apply the migration

From `D:\Rootcode` after committing the increment:

```powershell
docker compose up -d --build --wait api
docker compose exec api alembic upgrade head
docker compose exec api alembic current
docker compose exec api alembic check
```

Expected head: `0007_fleet_operations`. It adds empty daily availability/fuel
tables and preserves all 15 earlier tables. See the
[fleet input guide](../fleet/README.md#daily-operational-inputs) for their rules.
Migration `0006` created two outcome tables and three supporting parent indexes;
`0005` created the four planning foundation tables. None of these migrations
inserts planning data, availability or fuel usage. Demo seeds keep their previous
behavior. Daily input storage is not yet connected to allocation or publishing.

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
