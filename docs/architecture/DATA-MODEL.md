# Data Model

## Implemented database schema

Migration `0001_user_roles` implements `users`, `roles`, and `user_roles`.
Migration `0002_fleet_foundation` adds `depots`, `outlets`, and `vehicles`.
Migration `0003_orders` adds `orders`.
Migration `0004_user_scopes` adds `user_outlets` and `user_depots`.
Migration `0005_planning_foundation` adds `plans`, `plan_revisions`, `trips`, and
`trip_stops`. It preserves all earlier tables and inserts no planning records.
Migration `0006_plan_outcomes` adds `plan_assignments`, `deferral_decisions`, and
supporting unique indexes on orders, trips and stops. All 13 earlier tables and
records are preserved; no outcomes are inserted.
Migration `0007_fleet_operations` adds empty `vehicle_availability` and
`vehicle_fuel_usage` tables, preserving all 15 earlier tables and records.
Migrations `0008` and `0009` add optimization snapshots and publication/reservation
storage, described below.
The other tables in the core table list remain planned.

### Optimization snapshots

Migration `0008_plan_optimizations` adds the empty `plan_optimizations` table,
preserving all 17 earlier application tables and records. `request_id` is a
globally unique UUID primary key. `plan_revision_id` is unique, required and
references `plan_revisions.id` with RESTRICT. `request_hash` is a required 64-character
SHA-256 string of the validated request. Required JSON `input_snapshot` stores
the scoped order/fleet master inputs and canonical route inputs; `result_snapshot`
stores the typed API response, including created time, provenance, route IDs,
schedule and deferrals. Numeric inputs retain decimal strings.

The service appends snapshots and canonical route/assignment rows in one transaction.
It never updates an earlier optimized revision. Immutability is enforced by the
service, not a database trigger. A snapshot cannot survive deletion of its referenced
revision; RESTRICT prevents that deletion until the snapshot is explicitly removed.
Its copied JSON IDs are historical data, not additional foreign keys; canonical
trip/stop/assignment rows remain the relational references.

Downgrading to `0007_fleet_operations` removes replay keys and snapshots but retains
the revisions, routes and outcomes. This loses retry protection and historical
input evidence, so rollback testing must use a disposable database.

### Publications and fuel reservations

Migration `0009_plan_publications` preserves all 18 earlier application tables and adds:

| Table / index | Stored fields and constraints |
|---|---|
| `plan_publications` | UUID `request_id` primary key (replay key); unique required `plan_id` and `plan_revision_id`; `request_hash` (64-character SHA-256); required `published_by` user; timezone-aware `published_at`; JSON `result_snapshot`. All FKs `RESTRICT`. |
| `fuel_reservations` | UUID `id`; unique `trip_id`; `vehicle_id`; `service_date` (`DATE`, Colombo); `fuel_l` `NUMERIC(12, 3)` from 0 to below 1,000,000,000; database-default `created_at`. Composite FK `(trip_id, vehicle_id)` to trips, indexed by `(vehicle_id, service_date)`. |
| `uq_plan_revisions_one_published` | Partial unique index on `plan_revisions(plan_id)` where `status = 'PUBLISHED'`. |
| `uq_trips_id_vehicle` | Unique `(id, vehicle_id)` target for the reservation FK. |

The publication row identifies the effective published revision. The publish service
writes it, trip drivers, reservations, revision/plan status and order statuses in
one transaction. Reservations are counted for service dates from today onward;
earlier days use consumed daily totals, so no release column is needed. Published
trips without reservations are treated as inconsistent and block planning.
Republication is not supported. Downgrading to `0008_plan_optimizations` drops both
tables and indexes but keeps published revisions, drivers and order statuses;
re-upgrading leaves those published trips without reservations, which then block
planning for that week. Test rollback only on disposable databases.

### Loading events and readiness

Migration `0010_load_events` preserves all 20 earlier application tables and adds:

| Table / index | Stored fields and constraints |
|---|---|
| `load_events` | Client-supplied UUID `id` (stable event ID); `trip_id`; `assignment_id`; `order_id`; positive `sequence_number`, unique per trip; `status` `LOADED`/`MISSING`/`DAMAGED`; nullable `note` (at most 500, required and non-blank unless `LOADED`); `request_hash`; nullable UTC `occurred_at`; required `recorded_by` user and `recorded_at`. Composite FK `(assignment_id, trip_id, order_id)` to `plan_assignments`, so the order must be served on that trip. Indexed by `(trip_id, order_id)`. |
| `trip_loading_completions` | `trip_id` primary key; unique `request_id`; positive `last_event_sequence`; `loaded_count > 0` and non-negative missing/damaged counts; `confirmed_by`; `confirmed_at`. |
| `uq_plan_assignments_id_trip_order` | Unique `(id, trip_id, order_id)` target for the event FK. |

All FKs use `RESTRICT`. Events are never updated; the latest sequence per order is
the current outcome. Trip/order status changes are written by the loading service
in the same transaction. Downgrading to `0009_plan_publications` drops both tables
and the index but keeps any `LOADING`/`READY` trip and `LOADING` order statuses;
test rollback only on disposable databases.

### Delivery events and proof of delivery

Migration `0011_delivery_events` preserves all 22 earlier application tables and adds:

| Table / index | Stored fields and constraints |
|---|---|
| `proof_of_delivery` | Client UUID `id`; `trip_id`; unique `trip_stop_id`; `receiver_name` (at most 120, not blank); `photo_mime_type` `image/jpeg`/`image/png`; `photo_bytes` (`BYTEA`); `photo_size_bytes` 1 to 1,000,000; `photo_sha256`; `request_hash`; nullable UTC `captured_at`; `uploaded_by`; `uploaded_at`. Composite FK `(trip_stop_id, trip_id)` to `trip_stops`. |
| `delivery_events` | Client UUID `id`; `trip_id`; nullable `trip_stop_id`; `event_type` `TRIP_STARTED`/`ARRIVED`/`DELIVERED`/`FAILED`/`TRIP_COMPLETED`; `reason_code` and non-blank `note` required only for `FAILED`; `pod_id` required only for `DELIVERED`; positive per-trip `sequence_number`; `request_hash`; nullable UTC `occurred_at`; `recorded_by`; `recorded_at`. Stop events need a stop, trip events must not have one. FKs `(trip_stop_id, trip_id)` to `trip_stops` and `(pod_id, trip_stop_id)` to the same stop's POD. |
| Partial unique indexes | One `ARRIVED` per stop, one `DELIVERED`/`FAILED` outcome per stop, one `TRIP_STARTED` and one `TRIP_COMPLETED` per trip. |
| `uq_trip_stops_id_trip`, `uq_proof_of_delivery_id_stop` | Composite FK targets. |

The original sketch linked `proof_of_delivery.delivery_event_id` to an event. Because
POD must exist before the stop is delivered, the POD references its stop instead and
the `DELIVERED` event references the POD. All FKs use `RESTRICT`; evidence and events
are append-only (never updated). Trip, stop and order statuses are updated by the
delivery service in the same transaction. Downgrading to `0010_load_events` drops both
tables and the indexes, deleting stored photos, but keeps trip/stop/order statuses;
test rollback only on disposable databases.

### Receipt confirmations

Migration `0012_receipt_confirmations` preserves all 24 earlier application tables
and adds `receipt_confirmations`: client request UUID `id`; unique `order_id`;
`outlet_id` with a composite FK `(order_id, outlet_id)` to `orders`; required
`delivery_event_id` (the Driver's `DELIVERED` event); `confirmed_by` user; UTC
`confirmed_at`. All FKs use `RESTRICT`, with indexes on outlet, delivery event and
confirming user. The service writes the receipt and the order's
`RECEIPT_CONFIRMED` status in one transaction; no discrepancy fields are stored
because none are specified. Downgrading to `0011_delivery_events` drops the table but
keeps `RECEIPT_CONFIRMED` order statuses; test rollback only on disposable databases.

### Sync receipts

Migration `0013_sync_events` preserves all 25 earlier application tables and adds
`sync_events`: UUID `id`; unique client `event_id`; `device_id` (1-100 characters,
not blank); `user_id` (token identity); `trip_id`; `entity_type`
(`TRIP`/`STOP`/`ORDER`) with `entity_id`; `event_type` (the seven sync types);
`request_hash`; `received_at`. FKs to users and trips use `RESTRICT`; indexes cover
the user and `(trip_id, received_at)`. A receipt is inserted only in the same
transaction as a successful domain change, never for failures. Domain tables keep
their own event IDs, so replays still resolve if a receipt is missing. Downgrading
to `0012_receipt_confirmations` drops only this table; test rollback on disposable
databases.

### Audit history

Migration `0014_audit_events` preserves all 26 earlier application tables and adds
`audit_events`: UUID `id`; server `occurred_at`; `actor_id` (authenticated user);
`action` (eleven allowed values); `entity_type` (`PLAN`/`TRIP`/`STOP`/`ORDER`) and
`entity_id`; `depot_id`; nullable `trip_id`; `source_id` (the domain record; the
trip for sync conflicts);
unique `dedupe_key` (`ACTION:source_id`; sync conflicts use trip, user, type and reason);
JSON `details`. FKs to users, depots and trips use `RESTRICT`. Indexes:
`(depot_id, occurred_at)`, `(entity_type, entity_id)`, actor and trip. Rows are
append-only and written by the publication, loading, delivery, POD and receipt
services inside the domain transaction; sync conflicts are written after the rolled-back
attempt. No rows are backfilled. Downgrading to `0013_sync_events` drops the table;
test rollback only on disposable databases.

### Identity

- `users`: UUID primary key, unique lowercase/trimmed nonempty email (up to 320
  characters), nonempty `password_hash` (up to 255 characters), `is_active`
  defaulting to true, and required timezone-aware `created_at` set by PostgreSQL.
- `roles`: UUID primary key and unique `code`, restricted to `DISPATCHER`,
  `STORE_MANAGER`, `DRIVER`, or `LOADER`. The migration inserts these four records
  using fixed IDs; application code should look them up by code.
- `user_roles`: composite primary key `(user_id, role_id)` and foreign keys to
  both tables. A user can hold multiple roles. Deleting a user or role removes
  the associated assignments; deleting a user never deletes a role definition.

UUIDs for new users are generated by the application. Migrations do not create
accounts; the explicit demo seed does. Login validates email, verifies Argon2id
passwords and issues access tokens. Request guards reload active state, roles
and resource assignments from the database.

### User resource assignments

- `user_outlets`: composite primary key `(user_id, outlet_id)`, referencing
  `users.id` and `outlets.id`, with a secondary index on `outlet_id`.
- `user_depots`: composite primary key `(user_id, depot_id)`, referencing
  `users.id` and `depots.id`, with a secondary index on `depot_id`.
- Every foreign key uses `ON DELETE CASCADE` to revoke an assignment when its
  user or resource is deleted. Removing an assignment never deletes a user,
  outlet or depot. Existing fleet/order `RESTRICT` constraints remain unchanged.
- Multiple users may share a resource, and one user may have multiple assigned
  resources. Duplicate pairs and references to missing records are rejected.

These two mapping tables fill the previously unspecified account-to-resource
relationship. They are separate from role membership: a scope check requires
both the endpoint's required role and an explicit assignment. Depot assignments
do not automatically grant Store Manager outlet access or Driver trip access.
Domain endpoints must select the appropriate role and resource boundary.

The migration adds empty tables, preserves all existing data and grants no
access automatically. Demo account seeding does not assign resources. The separate
[demo resource seed](../../apps/api/app/fleet/README.md#synthetic-demo-data) creates
synthetic records and assigns the demo store/depot to the intended demo accounts.
Other assignments need trusted data setup; there is no public assignment-management
endpoint. Login and `/me` return
sorted `outlet_ids` and `depot_ids` from the current mappings.

Downgrading to `0003_orders` deletes the mapping tables and their assignments,
while retaining all seven previous tables and records. Re-upgrading starts with
empty mappings; lost assignments would need to be restored explicitly.

### Fleet master data

All fleet columns below are required. IDs are UUID primary keys generated by the
application; the database does not generate them for direct SQL inserts.

| Table | Fields and rules |
|---|---|
| `depots` | `id`, `name` (up to 120 characters, not blank). Names are not unique; references use `id`. |
| `outlets` | `id`, `brand` and `district` (up to 120 characters each), `dock_type` (up to 64), `depot_id`, `parking_constraint`, delivery start/end times, and `mall_window`. Text labels must not be blank. |
| `vehicles` | `id`, `depot_id`, `type` (`van` or `truck`), `temperature_type` (`ambient` or `reefer`), and the four numeric fields below. |

Both `outlets.depot_id` and `vehicles.depot_id` are indexed foreign keys to
`depots.id`. Deleting a depot is rejected while any outlet or vehicle references
it. The migration does not insert depot, outlet, or vehicle records. The explicit
demo resource seed adds one depot, two outlets and two vehicles using fixed IDs;
it preserves matching rows and rejects conflicting data without overwriting it.

| Vehicle field | PostgreSQL type | Allowed stored values |
|---|---|---|
| `weight_cap_kg` | `NUMERIC(12, 3)` | Greater than 0 and less than 1,000,000,000 kg |
| `volume_cap_m3` | `NUMERIC(12, 3)` | Greater than 0 and less than 1,000,000,000 cubic metres |
| `km_per_l` | `NUMERIC(8, 3)` | Greater than 0 and less than 100,000 km/l |
| `weekly_fuel_quota_l` | `NUMERIC(12, 3)` | At least 0 and less than 1,000,000,000 litres |

These fields store three decimal places and reject NaN and infinity. A zero fuel
quota is allowed. Daily consumption storage and conditional input APIs are
implemented below. Remaining-fuel calculations and enforcing the quota during
planning remain future work.

Outlet delivery rules:

- `parking_constraint` is `none` or `van_only`.
- `window_open_time` and `window_close_time` are `TIME WITHOUT TIME ZONE`,
  interpreted as local Asia/Colombo clock times.
- A close time earlier than the open time means the window crosses midnight:
  `22:00` to `02:00` closes the following day. Equal times are rejected; they do
  not represent a 24-hour window.
- `mall_window` is a boolean, defaulting to `false`. For example, a mall that
  accepts deliveries from `08:00` to `10:00` uses those same start/end fields
  with `mall_window=true`. There is no second pair of delivery times.
- The boolean interpretation of `mall_window` is the current implementation
  choice because the supplied documents did not specify its format.
  `dock_type` is a required text label because its allowed values were also
  unspecified; there is no fixed dock-type list yet.

Fleet storage enforces field and foreign-key constraints. Daily availability
and fuel records are defined below; route allocation and planning rules are
not implemented. `GET /api/v1/fleet` provides Dispatcher-only vehicle
reads scoped to current depot assignments, including assigned depot choices.
Separate depot-scoped daily-input endpoints support availability/fuel writes;
there are no public master-data write endpoints. These APIs add no schema changes.

### Daily vehicle availability and fuel usage

| Table | Stored fields and constraints |
|---|---|
| `vehicle_availability` | UUID `id`; required `vehicle_id`; required `availability_date` (`DATE`); required `is_available` (`BOOLEAN`, no default); required timezone-aware database-default `created_at`. Unique `(vehicle_id, availability_date)`. |
| `vehicle_fuel_usage` | UUID `id`; required `vehicle_id`; required `usage_date` (`DATE`); required `fuel_used_l` (`NUMERIC(12, 3)`, `0 <= value < 1,000,000,000`, no default); required timezone-aware database-default `created_at`. Unique `(vehicle_id, usage_date)`. |

Both dates use the Asia/Colombo calendar. Availability applies to a whole day;
partial-day windows are unsupported. Missing availability is unknown, not true.
Fuel usage is one authoritative consumed-fuel total across all trips for that
day; corrections replace it, rather than appending or adding another daily total.
Zero is explicitly known zero; missing usage is unknown. Numeric bounds reject
NaN and infinity, but allow actual usage above a vehicle's quota to be recorded.

The daily formats and whole-day availability are implementation choices, since
the supplied documents name these tables without specifying their fields.
The intended quota week is Monday–Sunday in Colombo, also an implementation
assumption; this migration performs no weekly calculation. Future quota checks
must separately account for reservations on unexecuted published trips, avoid
double counting, and handle incomplete inputs and concurrent updates/publishing.

Vehicle foreign keys use `RESTRICT`, including deletion through the ORM with
relationships loaded. Removing a daily row never deletes the vehicle. Unique
keys start with `vehicle_id`, supporting both FK lookups and date-range reads.
UUIDs are application-generated. Creation timestamps do not track later changes.
Dispatcher daily GET/PUT APIs now expose these records with depot scope. Writes
require create-only or current-state preconditions and hold the vehicle row lock
through the PostgreSQL transaction. Content-hash ETags detect changed values;
they are not monotonic edit versions or an audit history. Fuel writes reject
future Colombo dates; availability permits historical/future dates. Audit history,
weekly calculations and planner integration remain future work. No records are
inserted by this migration or demo seeds; the master fleet list and plan APIs
retain their existing response shapes. See the
[daily API contract](API-CONTRACTS.md#daily-fleet-inputs).

Downgrading to `0006_plan_outcomes` drops only these two tables and their data,
preserving all 15 earlier tables. Reapplying creates empty tables. See the
[fleet operational guide](../../apps/api/app/fleet/README.md#daily-operational-inputs).

### Orders

- `id`: UUID primary key generated by the application.
- `outlet_id`: required indexed foreign key to `outlets.id`. An outlet with
  orders cannot be deleted; deleting an order does not delete its outlet.
- `requested_delivery_date`: required indexed `DATE`, interpreted on the local
  Asia/Colombo calendar. Store submission persists the accepted date after the
  16:00 cutoff adjustment. Multiple orders per outlet/date are allowed.
- `temperature_requirement`: required `ambient` or `chilled`.
- `order_weight_kg` and `order_volume_m3`: required `NUMERIC(12, 3)`, greater than
  zero and less than 1,000,000,000, rejecting NaN and infinity.
- `status`: required, default `CONFIRMED`; allowed values match the shared
  contract: `CONFIRMED`, `PLANNED`, `DEFERRED`, `LOADING`, `OUT_FOR_DELIVERY`,
  `DELIVERED`, `RECEIPT_CONFIRMED`.
- `created_at`: required timezone-aware timestamp, defaulting to database time.

The migration starts the order table empty and preserves existing identity and
fleet records. The Store create/list/detail API now applies role/outlet checks
and next-day cutoff handling. Original requested date and cutoff flag are only
returned in the create response; the existing column retains the accepted date.
Dispatcher listing joins each order to its outlet's current depot and restricts
results/counts to assigned depots; it includes outlet constraints and depot names.
That read API does not rely on Store outlet grants or snapshot depot ownership.
Order status transitions and receipt processing remain separate future work.

### Planning foundation

| Table | Stored fields and constraints |
|---|---|
| `plans` | UUID `id`; required `depot_id` and `created_by` user references; required local `delivery_date`; `status` defaults to `DRAFT`; required timezone-aware `created_at` defaults to database time. Unique `(depot_id, delivery_date)`. |
| `plan_revisions` | UUID `id`; required `plan_id`; positive integer `revision_number`, unique within the plan; `status` defaults to `DRAFT`; nullable timezone-aware `published_at`. |
| `trips` | UUID `id`; required `plan_revision_id` and `vehicle_id`; nullable `driver_id` user reference; integer `trip_number` of 1 or 2; `status` defaults to `PLANNED`. Unique `(plan_revision_id, vehicle_id, trip_number)`. |
| `trip_stops` | UUID `id`; required `trip_id` and `outlet_id`; positive integer `sequence_number`; nullable timezone-aware `planned_arrival_time`; `status` defaults to `PLANNED`. Unique `(trip_id, sequence_number)` and `(trip_id, outlet_id)`. |

The explicit depot on a plan supports the existing Dispatcher scope model. One
workspace per depot/date prevents duplicate planning workspaces; alternatives
belong in numbered revisions. UUIDs are application-generated. All foreign keys
use `ON DELETE RESTRICT`, and each has an index or leading unique-constraint
column for lookups. Existing identity, fleet and order records are not altered.

Plan and revision statuses are `DRAFT`/`PUBLISHED`. A revision's `published_at`
must be null for `DRAFT` and non-null for `PUBLISHED`. The plan status is intended
as a publication summary; consistency with its revisions requires the future
publish service. Revision numbers are positive/unique but need not be contiguous.
There is no current-revision pointer; choosing the effective published revision
and avoiding concurrent publication conflicts are service responsibilities.

Trips use the shared `PLANNED`, `LOADING`, `READY`, `IN_PROGRESS`, `COMPLETED`
statuses. The optional driver reference enables later assignment; it does not
validate a user's role/activity or grant trip access. Stop statuses are `PLANNED`,
`ARRIVED`, `DELIVERED`, `FAILED`, also exported by shared types. Transition checks,
failure evidence and publishing remain unimplemented. A stop is one outlet visit,
not one order. Several orders may map to a stop through the assignments below;
another trip may visit the same outlet.

`planned_arrival_time` includes both date and timezone (PostgreSQL `TIMESTAMPTZ`),
so a stop can fall after midnight. It can remain null until scheduling computes
it. Stop sequence numbers are positive/unique within a trip; contiguous ordering
is a later validation rule. Creation/publication timestamps are also timezone-aware.

Trip slots enforce **at most two trips per vehicle per revision**, not the daily
operational limit across alternative published revisions or depot plans. The
future publisher must enforce the effective revision, complete-day limits,
home-depot compatibility, driver authorization and planning constraints.
Published revision immutability is not enforced by these storage checks; future
services must prohibit edits and create new revisions. The plan API creates a
draft plan with its initial empty revision atomically and reads metadata/counts;
it cannot edit existing revisions, allocate orders, or publish data.

See the [planning migration guide](../../apps/api/app/planning/README.md).
Downgrading from `0005` to `0004_user_scopes` drops these four foundation tables;
rollback/reapply checks use disposable databases.

### Order outcomes and deferral reasons

| Table | Stored fields and constraints |
|---|---|
| `plan_assignments` | UUID `id`; required `plan_revision_id`, `order_id`, `outlet_id`, `outcome`; nullable `trip_id` and `trip_stop_id`; required timezone-aware `created_at` with database-time default. Unique `(plan_revision_id, order_id)`. |
| `deferral_decisions` | UUID `id`; required `plan_revision_id`, `order_id`, `assignment_outcome` (defaults to and must equal `DEFERRED`), `reason_code`, `reason_text`; required timezone-aware `created_at` with database-time default. Unique `(plan_revision_id, order_id)`. |

An assignment is the canonical outcome for one order in a revision: `SERVED`
requires both route IDs, and `DEFERRED` requires both to be null. `SERVED` means
assigned for delivery, not physically delivered. Both outcomes for the same
order/revision cannot coexist. Alternatives can exist in different revisions.
Neither table changes the order's live status automatically.

Composite foreign keys require `(order_id, outlet_id)` to match the order,
`(trip_id, plan_revision_id)` to match the trip, and
`(trip_stop_id, trip_id, outlet_id)` to match the stop. A separate revision foreign
key also covers deferred assignments. The migration adds unique indexes
`uq_orders_id_outlet`, `uq_trips_id_revision`, and `uq_trip_stops_id_trip_outlet`
as reference targets; they do not rewrite existing rows. Changing referenced
parent IDs/outlet/revision values to inconsistent combinations is blocked.

The deferral's revision/order/constant outcome reference one deferred assignment,
so a reason cannot belong to a served or missing result. A unique supporting
assignment key includes the outcome for that reference. Every new foreign key
uses `RESTRICT`; its leading column has an index or unique key. Reasons must be
removed before their assignment can be removed or switched to served.

Allowed reason codes are `NO_COMPATIBLE_VEHICLE`, `REEFER_CAPACITY_EXHAUSTED`,
`VAN_CAPACITY_EXHAUSTED`, `WEIGHT_CAPACITY`, `VOLUME_CAPACITY`, `TIME_WINDOW`,
`FUEL_QUOTA`, `VEHICLE_UNAVAILABLE`, `TRIP_LIMIT`. These match the supplied
architecture. The single primary `reason_text` is required, at most 1,000
characters, and not solely spaces/tabs/line breaks.

A draft deferred result may exist without a reason until its explanation is
written. Future atomic result writing/publishing must require every deferred
result's reason and cover every selected order exactly once. These constraints
provide at-most-one outcome, not complete coverage, depot/date eligibility,
physical feasibility, current-publication selection or immutable published data.
The public plan API creates only draft workspaces; it cannot mutate outcomes.
Shared types export `AssignmentOutcome` and `DeferralReason`. Plan detail returns
per-revision saved counts, including deferred results missing reasons, without
claiming coverage or feasibility. Full allocation result DTOs remain future work.

Downgrading to `0005_planning_foundation` drops only the two outcome tables and
three supporting parent indexes; all 13 earlier tables and records remain.

All implemented model modules are registered in `apps/api/app/db/models.py` for Alembic.
Table creation is performed by explicit migrations, never at API startup.

## Core tables

```text
users
roles
user_roles
user_outlets
user_depots

depots
outlets
vehicles
vehicle_availability
vehicle_fuel_usage

orders

plans
plan_revisions
trips
trip_stops
plan_assignments
deferral_decisions

load_events
delivery_events
proof_of_delivery
receipt_confirmations

sync_events
audit_events
```

## Key table fields

### users
```text
id
email
password_hash
is_active
created_at
```

### depots

```text
id
name
```

### outlets
```text
id
brand
district
depot_id
dock_type
parking_constraint
window_open_time
window_close_time
mall_window
```

### vehicles
```text
id
type
temperature_type
weight_cap_kg
volume_cap_m3
km_per_l
weekly_fuel_quota_l
depot_id
```

### vehicle_availability
```text
id
vehicle_id
availability_date
is_available
created_at
```

### vehicle_fuel_usage
```text
id
vehicle_id
usage_date
fuel_used_l
created_at
```

### orders
```text
id
outlet_id
requested_delivery_date
temperature_requirement
order_weight_kg
order_volume_m3
status
created_at
```

### plans
```text
id
depot_id
delivery_date
status
created_by
created_at
```

### plan_revisions
```text
id
plan_id
revision_number
status
published_at
```

### trips
```text
id
plan_revision_id
vehicle_id
driver_id (nullable)
trip_number
status
```

### trip_stops
```text
id
trip_id
outlet_id
sequence_number
planned_arrival_time
status
```

### plan_assignments
```text
id
plan_revision_id
order_id
outlet_id
outcome
trip_id (nullable)
trip_stop_id (nullable)
created_at
```

### deferral_decisions
```text
id
order_id
plan_revision_id
assignment_outcome (always DEFERRED)
reason_code
reason_text
created_at
```

### proof_of_delivery
```text
id
trip_id
trip_stop_id (replaces delivery_event_id)
receiver_name
photo_mime_type
photo_bytes BYTEA
photo_size_bytes
created_at
```

### sync_events
```text
id
event_id UNIQUE
device_id
user_id
trip_id
request_hash
entity_type
entity_id
event_type
received_at
```

## Planned workflow invariants

These are requirements for later workflow and planning increments. The current
planning migration enforces references, allowed values, revision/sequence
uniqueness, two trip slots per vehicle/revision, and one consistent outcome per
order/revision; it does not enforce these complete operational rules.

- `sync_events.event_id` unique
- max 2 trips per vehicle/day
- chilled never assigned to ambient vehicle
- van-only outlet never assigned to truck
- published plan revision immutable
- delivery evidence append-only
