# API Contracts

## Implementation status

Authentication, Store order create/list/detail, Dispatcher order listing, fleet
reads, daily fleet input GET/PUT, plan create/list/detail and plan publishing routes are
implemented. Store receipt, live operations, Loader and Driver routes remain planned.
A live, read-only plan compatibility preview is implemented for individual
order/vehicle rules; it is not full feasibility validation or optimization.
Internal capacity allocation and fixed-group route scheduling engines are also
implemented, with validated JSON route input import and a synthetic example.
The optimize API now orchestrates these engines with scoped database inputs,
bounded repair/reallocation, independent snapshot validation and atomic saved draft
results. Publishing revalidates a saved draft against current inputs, assigns drivers,
reserves fuel and updates order statuses; see [publishing](#publishing-and-driver-assignment).
Migration `0005_planning_foundation` adds storage for plans, revisions, trips and
stops. Plan workspace, optimization and publishing APIs use this storage.
Migration `0006_plan_outcomes` adds order result and deferral reason storage,
without new routes or changes to existing order JSON/status behavior.
Migration `0007_fleet_operations` adds daily availability and fuel-usage storage.
Migration `0008_plan_optimizations` adds request replay keys and immutable-by-service
input/result snapshots for each optimized revision. Migration `0009_plan_publications`
adds publication replay records, per-trip fuel reservations and a one-published-revision index.
Separate daily-input routes now use this storage; the fleet list still returns
only master data. Daily writes require conditional headers described below.
The API also exposes `GET /health`,
`GET /ready`, and the same checks under `/api/v1`. Health returns `status`,
`service`, and `version`; readiness returns 200 when PostgreSQL is reachable
and 503 otherwise. Demo accounts can be created explicitly with the
[seed command](../../apps/api/app/auth/README.md#create-demo-accounts).

## Contract freeze

Breaking changes require updates to:
- backend schema
- shared TypeScript contracts
- this document
- affected client(s)

## Auth

```text
POST /api/v1/auth/login
GET  /api/v1/me
```

Login accepts `Content-Type: application/json`:

```json
{"email": "driver@example.com", "password": "<account-password>"}
```

The email is trimmed, lowercased and validated. Passwords are preserved exactly
and must contain 1–1024 UTF-8 bytes. Extra fields are rejected. A successful
login returns 200 with this shape (values are illustrative, not seeded credentials):

```json
{
  "access_token": "<signed-access-token>",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "8ea62421-3813-4d37-a06b-546b5f9d75fd",
    "email": "driver@example.com",
    "is_active": true,
    "roles": ["DRIVER"],
    "outlet_ids": [],
    "depot_ids": []
  }
}
```

`expires_in` is seconds, controlled by `ACCESS_TOKEN_EXPIRE_MINUTES` (default 30).
`GET /api/v1/me` takes `Authorization: Bearer <access_token>` and returns the
same user shape directly, without the login wrapper. Roles are sorted and may
be `DISPATCHER`, `STORE_MANAGER`, `DRIVER`, or `LOADER`; the list can be empty.
`outlet_ids` and `depot_ids` are sorted arrays of UUID strings identifying explicit
resource assignments. Both arrays are empty for existing/demo users until a
trusted data setup assigns resources. The explicit
[demo resource seed](../../apps/api/app/fleet/README.md#synthetic-demo-data) assigns
the demo Store Manager one outlet and the Dispatcher/Loader/Driver one depot.
A depot assignment does not implicitly
grant Store Manager access to its outlets, or Driver access to its trips.
The API reloads active status, roles and resource assignments from the database
on every authenticated request. Token claims never grant roles or resource
access. Successful auth responses use `Cache-Control: no-store`.

| Status | Meaning | Body |
|---|---|---|
| 401 | Incorrect credentials, unknown/inactive user, or missing/invalid/expired bearer token | `{"detail":"Invalid or missing credentials"}` |
| 403 | Authenticated user lacks the required role or resource assignment | `{"detail":"Insufficient permissions"}` |
| 422 | Invalid login JSON or fields | `{"detail":[{"loc":["body","email"],"msg":"...","type":"..."}]}` |
| 503 | Authentication signing key is unavailable/invalid or database query fails | `{"detail":"Authentication unavailable"}` |

401 responses include `WWW-Authenticate: Bearer`. Validation errors contain only
`loc`, `msg` and `type`, with no raw input or password values. A roleless active
account can log in and read `/me`, but cannot pass a role guard. Outlet/depot
scope helpers require both a matching role and a current assignment. Future
business routes must call those checks and filter collection queries to assigned
resources. Trip/Driver assignment checks remain future work.

Login accepts only `email` and `password`; attempts to supply roles, `outlet_ids`
or `depot_ids` are rejected with 422. No public API can change assignments.

The shared `@waypoint/api-contracts` package exports `LoginRequest`, `LoginResponse`
and `AuthUser`. Its client accepts a token provider and sends the bearer header;
it does not store credentials. Client sign-in screens remain pending. There is
no refresh endpoint yet; expired tokens require another login.
See the [auth setup guide](../../apps/api/app/auth/README.md) for signing-key setup.

## Store Manager

```text
GET  /api/v1/store/orders
POST /api/v1/store/orders
GET  /api/v1/store/orders/{order_id}
POST /api/v1/store/orders/{order_id}/receipt
```

The first three routes are implemented; receipt confirmation is still planned.
Every implemented Store route requires bearer authentication and `STORE_MANAGER`.
Assignments are reloaded on each request. A depot grant alone never grants Store
outlet access. There is no role-only bypass for Dispatcher/Driver/Loader.

### Create an order

`POST /api/v1/store/orders` accepts JSON with these five required fields:

```json
{
  "outlet_id": "<UUID from /me outlet_ids>",
  "requested_delivery_date": "2026-10-05",
  "temperature_requirement": "chilled",
  "order_weight_kg": "125.125",
  "order_volume_m3": "0.875"
}
```

Use a future date in `YYYY-MM-DD` format. Temperature must be `ambient` or
`chilled`. Weight and volume accept decimal strings or JSON numbers, must be
finite and positive, have at most three fractional digits, and be below
1,000,000,000. String inputs are recommended to avoid client floating-point
rounding. IDs, status and timestamps are server-owned; extra fields are rejected.

The supplied outlet must be assigned to the user. Successful creation returns
201 and `Location: /api/v1/store/orders/<id>`:

```json
{
  "order": {
    "id": "<server UUID>",
    "outlet_id": "<assigned outlet UUID>",
    "requested_delivery_date": "2026-10-05",
    "temperature_requirement": "chilled",
    "order_weight_kg": "125.125",
    "order_volume_m3": "0.875",
    "status": "CONFIRMED",
    "created_at": "2026-10-03T11:00:00Z"
  },
  "submitted_delivery_date": "2026-10-04",
  "cutoff_applied": true
}
```

This response illustrates a next-day request submitted after the cutoff.
Cutoff is 16:00 in `Asia/Colombo`, evaluated on the server. Before 16:00 tomorrow
is accepted; at or after 16:00 a request for tomorrow moves one calendar day
later. Requests for later dates are unchanged. Same-day/past requests return 422.
No weekend/holiday calendar is defined, so every calendar day is eligible.

`order.requested_delivery_date` stores the **accepted** date after this adjustment
and is the date used by list/detail and future planning. The original input is
returned as `submitted_delivery_date` with `cutoff_applied` for the confirmation
screen; that submission metadata is not stored in the current schema. An accepted
order is `CONFIRMED`, not a guarantee that optimization can serve it.

### List and detail

`GET /api/v1/store/orders` accepts optional `outlet_id`, `status`, and
`requested_delivery_date` filters. The date filter matches the accepted date.
Pagination uses `limit` (default 20, range 1–100) and `offset` (default 0, at least 0).
It returns `{"items":[<order>],"total":1,"limit":20,"offset":0}`. Both items and
total are scoped in SQL to currently assigned outlets. Results sort by creation
time descending, then UUID descending. Pagination can move as new orders arrive.
An unassigned account receives an empty list; an explicit unauthorized outlet
filter returns 403. No-match lists return 200 with an empty `items` array.

`GET /api/v1/store/orders/{order_id}` returns the order object directly. Missing
and other-outlet order IDs both return 404 with `{"detail":"Order not found"}`.
All successful responses use `Cache-Control: no-store`. Response quantities are
strings with three decimal places; `created_at` is a UTC timestamp.

| Status | Meaning |
|---|---|
| 401 | Missing/invalid token or inactive account |
| 403 | Incorrect role or unassigned create/filter outlet |
| 404 | Order absent or outside current outlet assignments |
| 409 | Insert integrity conflict; refresh outlet access before retrying |
| 422 | Invalid fields, query/path values, or same-day/past delivery date |
| 503 | Authentication or order database operation unavailable |

Order database failures return `{"detail":"Orders unavailable"}` without SQL
or connection details. Creation conflicts return
`{"detail":"Order could not be created; refresh outlet access"}`. Same-day/past
requests return `{"detail":"Delivery date must be after today in Asia/Colombo"}`;
field validation uses the existing sanitized 422 error array.

Creation is not idempotent: each successful POST creates an order. Clients must
not automatically retry a POST after an uncertain network outcome; refresh the
list first. Idempotency keys, status mutations and receipt submission are future
increments. Shared types are `OrderCreateRequest`, `OrderResponse`,
`OrderCreateResponse` and `OrderListResponse` in `@waypoint/api-contracts`.

## Dispatcher

```text
GET  /api/v1/dispatcher/orders
GET  /api/v1/fleet
POST /api/v1/plans
GET  /api/v1/plans
POST /api/v1/plans/{plan_id}/optimize
GET  /api/v1/plans/{plan_id}
GET  /api/v1/plans/{plan_id}/compatibility
POST /api/v1/plans/{plan_id}/publish
GET  /api/v1/operations/live
```

Order/fleet reads and plan create/list/detail require bearer authentication plus
`DISPATCHER`. Collection reads use current `UserDepot` assignments before counting or
paginating. Dispatcher access to orders follows each outlet's current depot;
Store `UserOutlet` assignments do not widen Dispatcher access. Other roles cannot
use these routes, even with a depot grant. No role bypass or all-depot access is
implicit. Revoking a grant takes effect on the next request.

### Dispatcher order queue

`GET /api/v1/dispatcher/orders` supports optional `depot_id`, `outlet_id`,
`status`, and `requested_delivery_date` filters. By default all accessible
statuses/dates are returned; use `status=CONFIRMED` for the confirmed order queue.
The date is the accepted delivery date stored after the Store cutoff adjustment.
Filters combine with AND. An explicit depot or outlet outside assigned depots,
including an unknown UUID, returns 403. Two individually authorized but
nonmatching depot/outlet filters return an empty list.

Pagination uses `limit` (default 20, range 1–100) and `offset` (default 0, at least
0). The response is `{"items":[<dispatcher-order>],"total":1,"limit":20,"offset":0}`.
Each item contains every field of the Store `OrderResponse`, plus:

```json
{
  "outlet": {
    "id": "<same UUID as outlet_id>",
    "brand": "Demo Store",
    "district": "Colombo",
    "depot_id": "<depot UUID>",
    "dock_type": "ground",
    "parking_constraint": "none",
    "window_open_time": "08:00:00",
    "window_close_time": "18:00:00",
    "mall_window": false
  },
  "depot": {"id": "<depot UUID>", "name": "Demo Depot"}
}
```

Delivery window strings are local `Asia/Colombo` times without a timezone offset;
they may include fractional seconds. A close time earlier than open is an
overnight window. `mall_window` flags a mall restriction on that same window.
Parking is `none` or `van_only`; `dock_type` is a text label. Orders sort by
creation time descending, then UUID descending. Quantities remain three-decimal
strings and `created_at` remains UTC. There is no order detail or mutation route
for Dispatcher in this increment.

### Fleet list

`GET /api/v1/fleet` supports optional `depot_id`, `type` (`van` or `truck`) and
`temperature_type` (`ambient` or `reefer`) filters, with the same pagination
limits. `items` contains vehicles, ordered by UUID ascending:

```json
{
  "items": [{
    "id": "<vehicle UUID>",
    "type": "van",
    "temperature_type": "reefer",
    "weight_cap_kg": "1200.000",
    "volume_cap_m3": "8.000",
    "km_per_l": "8.000",
    "weekly_fuel_quota_l": "120.000",
    "depot_id": "<assigned depot UUID>"
  }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "depots": [{"id": "<assigned depot UUID>", "name": "Demo Depot"}]
}
```

`total` counts filtered vehicles before pagination. `depots` lists all currently
assigned depots, or only the selected authorized depot when `depot_id` is supplied.
It sorts by name then UUID, includes empty depots, and is unaffected by vehicle
filters or pagination. This lets the frontend build a depot selector even with
zero matching vehicles. Vehicle numeric values are three-decimal strings.
`weekly_fuel_quota_l` is the configured quota, **not remaining fuel**. Vehicle
availability, fuel usage, trip counts and feasibility are not computed yet.
Daily availability and fuel inputs have separate GET/PUT endpoints below; they
are not connected to this list response. Missing daily records mean unknown,
not available or zero fuel used. See the
[storage rules](DATA-MODEL.md#daily-vehicle-availability-and-fuel-usage).

Both routes return 200 with empty `items` and `total: 0` when no rows match or
no depots are assigned; fleet also returns `depots: []` when none are assigned.
Successful responses use `Cache-Control: no-store`. Offset pages may shift when
data changes between requests.

| Status | Meaning |
|---|---|
| 401 | Missing/invalid token or inactive account |
| 403 | Incorrect role or explicit depot/outlet filter outside assigned depots |
| 422 | Invalid UUID, enum, date or pagination value |
| 503 | Authentication or database read unavailable |

Order read failures return `{"detail":"Orders unavailable"}`; fleet failures
return `{"detail":"Fleet unavailable"}`, without SQL/connection details.
The new shared types are `DepotResponse`, `OutletResponse`, `VehicleResponse`,
`FleetListResponse`, `DispatcherOrderResponse` and `DispatcherOrderListResponse`.
The read APIs need no additional migration. Draft optimization is documented below;
publishing, live operations and frontend screen integration remain future increments.

### Daily fleet inputs

```text
GET /api/v1/fleet/{vehicle_id}/availability/{availability_date}
PUT /api/v1/fleet/{vehicle_id}/availability/{availability_date}
GET /api/v1/fleet/{vehicle_id}/fuel-usage/{usage_date}
PUT /api/v1/fleet/{vehicle_id}/fuel-usage/{usage_date}
```

All require active `DISPATCHER` authentication and current vehicle depot access.
Missing and foreign vehicle IDs both return `404 {"detail":"Vehicle not found"}`.
Dates are strict `YYYY-MM-DD`. Availability writes accept past/today/future dates;
fuel writes accept only today/past in Asia/Colombo because they record actual
consumption. GET may read any stored date. No partial-day availability is implied.

PUT bodies (all other fields rejected):

```json
{"is_available":false}
```

```json
{"fuel_used_l":"12.345"}
```

The availability value must be a JSON boolean, not a number/string. Fuel is a
decimal string with at most three fractional digits, `0 <= value < 1000000000`;
exponents, signs, whitespace and nonfinite values are rejected. It replaces the
authoritative total across all trips for that vehicle/day. Recorded zero is known
zero; a missing row is unknown. Actual totals above quota may be recorded.

GET success (200) returns one of:

```json
{"id":"<UUID>","vehicle_id":"<UUID>","created_at":"2026-10-03T10:30:00Z","availability_date":"2026-10-03","is_available":false}
```

```json
{"id":"<UUID>","vehicle_id":"<UUID>","created_at":"2026-10-03T10:30:00Z","usage_date":"2026-10-03","fuel_used_l":"12.345"}
```

The response includes `ETag: "<64 lowercase hexadecimal characters>"` and
`Cache-Control: no-store`. The timestamp is row creation time, not last-edit time.
An accessible vehicle with no row returns 404 with `Daily availability not
recorded` or `Daily fuel usage not recorded`, respectively. No ETag/default value
is fabricated for missing data.

PUT requires exactly one supported conditional header:

| Header | Purpose | Success | Failed precondition |
|---|---|---|---|
| `If-None-Match: *` | Create an unrecorded day | 201, DTO and `Location` | 412 if already recorded |
| `If-Match: "<tag from GET>"` | Replace the current value | 200 and DTO | 412 if missing or changed |

GET again after success to obtain the next tag. PUT normalizes/enriches the
submitted body and therefore sends no ETag/Last-Modified validator, per
[RFC 9110 section 9.3.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4).
Tags describe the current representation, not edit history: an identical save
keeps the tag, and A → B → A can restore the earlier tag. On 412, reload and let
the user review the conflicting value before saving again. A lost success
response can likewise be recovered with GET; preconditions are not idempotency keys.

PostgreSQL locks the scoped vehicle before reading/comparing the record and holds
the lock through commit. This serializes API writes per vehicle at the default
READ COMMITTED isolation. Concurrent writes that change the same starting value
produce one success and one 412; two identical no-op replacements may both return
200. SQLite does not provide this concurrency guarantee. No quota reservation,
audit trail, weekly balance or plan update is performed.

| Status | Meaning |
|---|---|
| 400 | Unsupported/duplicate conditional header, both headers, weak/list tag, or `If-Match: *` |
| 401 / 403 | Missing/inactive credentials / missing Dispatcher role |
| 404 | Vehicle inaccessible/missing, or no recorded day |
| 409 | Other integrity conflict; reload the record |
| 412 | `Daily input changed; reload it before saving` |
| 422 | Invalid path/body or fuel date after today in Colombo |
| 428 | Missing required write precondition |
| 503 | Authentication or fleet input database operation unavailable |

Other integrity conflicts return `{"detail":"Fleet input conflict; reload the record"}`.
Database failures return `{"detail":"Fleet inputs unavailable"}` without SQL details;
failed writes roll back. Domain errors and success responses use `Cache-Control:
no-store`. Existing sanitized validation errors and authentication behavior apply.
CORS allows conditional headers and exposes `ETag` and `Location` to configured origins.

Shared types: `AvailabilityWriteRequest`, `FuelUsageWriteRequest`,
`VehicleAvailabilityResponse`, `VehicleFuelUsageResponse`, and `ApiResponse<T>`.
The new client method returns `{data, status, etag, location}`; `request<T>()`
continues returning only data. Both throw `ApiError` on unsuccessful HTTP status.

```typescript
const path = `/fleet/${vehicleId}/availability/${day}`;
const current = await api.requestWithMetadata<VehicleAvailabilityResponse>(path);
if (!current.etag) throw new Error('Missing daily input validator');
await api.request<VehicleAvailabilityResponse>(path, {
  method: 'PUT',
  headers: { 'If-Match': current.etag },
  body: JSON.stringify({ is_available: false }),
});
const refreshed = await api.requestWithMetadata<VehicleAvailabilityResponse>(path);
```

To create a missing day for a vehicle already obtained from `/fleet`, use PUT
with `If-None-Match: *` instead. There are no daily delete/bulk endpoints yet.
This API increment needs no new migration; apply `0007_fleet_operations` first.

### Plan workspaces

`POST /api/v1/plans` accepts only:

```json
{"depot_id":"<UUID from /me depot_ids>","delivery_date":"2026-10-05"}
```

The delivery date must be a `YYYY-MM-DD` string for today or a future date in
`Asia/Colombo`. Unlike Store submission, creating a planning workspace does not
apply the Store cutoff or move the date. Past dates return 422. Reading existing
historical plans is permitted. The depot must be assigned to the Dispatcher;
unknown/unassigned depots return 403. IDs, creator, statuses and revision numbers
are server-owned; extra fields are rejected.

A successful request commits a `DRAFT` plan and its empty `DRAFT` revision 1 in
one transaction. It returns 201 with `Location: /api/v1/plans/<id>` and the same
detail shape as `GET /api/v1/plans/{plan_id}`:

```json
{
  "id": "<plan UUID>",
  "depot_id": "<assigned depot UUID>",
  "delivery_date": "2026-10-05",
  "status": "DRAFT",
  "created_by": "<authenticated user UUID>",
  "created_at": "2026-10-03T10:30:00Z",
  "revisions": [{
    "id": "<revision UUID>",
    "revision_number": 1,
    "status": "DRAFT",
    "published_at": null,
    "trip_count": 0,
    "served_order_count": 0,
    "deferred_order_count": 0,
    "unexplained_deferred_count": 0
  }]
}
```

No orders, trips or outcomes are created/updated by this request. A duplicate
valid depot/date request returns 409 with
`{"detail":"A plan already exists for this depot and delivery date"}` and a
`Location` for the existing accessible plan. This also handles concurrent creates
using the database unique constraint. Existing statuses/revisions are preserved;
the request does not add a revision or overwrite a published plan. On 409, clients
can follow `Location` or find the plan with the list filters below. Approved CORS
origins can read the `Location` response header. Generic idempotency keys are not
implemented; the unique depot/date pair prevents duplicate workspaces.

`GET /api/v1/plans` supports optional `depot_id`, `delivery_date` and `status`
(`DRAFT`/`PUBLISHED`) filters. Filters combine with AND. Pagination uses `limit`
(default 20, range 1–100) and `offset` (default 0, nonnegative). It returns
`{"items":[<plan metadata>],"total":1,"limit":20,"offset":0}`. Each item contains
the six plan fields above, without `revisions`. Rows sort by delivery date
descending, then UUID descending. Totals and pages are restricted in SQL to
current depot assignments. No assignments/no matches produce an empty list.
An explicit unknown/unassigned depot filter returns 403. Pages can shift when
new plans arrive; a filter on status uses the stored plan summary status.

`GET /api/v1/plans/{plan_id}` returns metadata and all saved revision summaries,
sorted by revision number ascending. Missing plans and plans outside current
depot assignments both return `404 {"detail":"Plan not found"}`. Any Dispatcher
assigned to the depot can read its plans, regardless of the original creator.
Revoking depot/role access takes effect on the next request. Preexisting plans
without revisions return `revisions: []`; new API creations always include revision 1.

Revision counts describe stored rows for that revision. Served/deferred counts
count assignments, not stops; `unexplained_deferred_count` counts deferred results
without a reason. Separate aggregates prevent trips from multiplying outcome
counts. These are **not** a feasibility check or proof that all selected orders
are covered. The endpoint does not select an effective published revision or
return full trip/stop/order results. Timestamps are UTC; `published_at` is nullable.
Optimization creates draft revisions and exposes saved result details through
the optimization endpoints documented below. Publishing and manual revision
editing remain later increments. A `PUBLISHED` value read from storage is not
a new validation verdict.

All successful responses and 404/409/503 errors use `Cache-Control: no-store`.

| Status | Meaning |
|---|---|
| 401 | Missing/invalid token or inactive user |
| 403 | Wrong role or unassigned create/list-filter depot |
| 404 | Detail plan missing or outside current depot scope |
| 409 | Existing depot/date plan, or another insert integrity conflict |
| 422 | Invalid fields/query/path or a past creation date |
| 503 | Authentication or planning database operation unavailable |

Other insert conflicts return `{"detail":"Plan could not be created; refresh depot access"}`
without `Location`; database failures return `{"detail":"Plans unavailable"}` without
connection/SQL details. Failed inserts or commits roll back both plan and revision.
The past-date error is `{"detail":"Delivery date cannot be before today in Asia/Colombo"}`.
Field validation uses the existing sanitized 422 format.

Shared types: `PlanCreateRequest`, `PlanResponse`, `PlanRevisionResponse`,
`PlanDetailResponse`, `PlanListResponse`. The plan endpoints introduced no new
migration; at least `0006_plan_outcomes` is required for revision counts. Apply
the current migration head listed in the root README when updating the backend.

### Plan compatibility preview

`GET /api/v1/plans/{plan_id}/compatibility` requires an active `DISPATCHER` bearer
token and current access to the plan's depot. Missing and foreign plans return
the same `404 {"detail":"Plan not found"}`. Depot grants do not bypass the role
check; outlet grants alone do not grant access. Historical and published plans
may be previewed, using live inputs rather than any saved revision's contents.

The endpoint selects only `CONFIRMED` orders whose accepted delivery date equals
the plan date and whose outlet currently belongs to the plan depot. `limit`
defaults to 20 (1–100), `offset` to 0 (nonnegative). `total` counts all eligible
orders before pagination. Order pages and vehicle lists use UUID ascending order.
All vehicles in that depot are evaluated for each order on the page; vehicles
from another assigned depot are excluded. The response contains:

```typescript
interface PlanCompatibilityResponse {
  plan_id: string;
  depot_id: string;
  delivery_date: string;
  is_complete_plan_validation: false;
  items: {
    order: DispatcherOrderResponse;
    candidate_vehicle_ids: string[];
    excluded_vehicles: { vehicle_id: string; reasons: CompatibilityIssue[] }[];
  }[];
  vehicles: { vehicle: VehicleResponse; is_available: boolean | null }[];
  total: number;
  limit: number;
  offset: number;
}
```

Nested order/outlet/depot and vehicle shapes are the existing read DTOs above,
including three-decimal numeric strings. Availability is outer-joined on the
**plan's date**, with null meaning unknown, false unavailable, and true available.
A missing record never defaults to available, and another date is never reused.

For each order, candidates pass all implemented individual checks. Excluded
vehicles include every failed check in this stable order:

| `CompatibilityIssue` | Meaning |
|---|---|
| `DEPOT_MISMATCH` | Different vehicle/outlet home depots; normally prevented by API selection. |
| `TEMPERATURE_MISMATCH` | Chilled order and ambient vehicle; ambient orders permit either type. |
| `VAN_REQUIRED` | Van-only outlet and truck. |
| `WEIGHT_CAPACITY` | Whole order weight exceeds capacity; equality is allowed. |
| `VOLUME_CAPACITY` | Whole order volume exceeds capacity; equality is allowed. |
| `VEHICLE_UNAVAILABLE` | Explicit false availability for the plan date. |
| `AVAILABILITY_UNKNOWN` | Missing availability for the plan date. |

Candidate/excluded lists are disjoint and cover all returned vehicles per order;
each list is sorted by vehicle UUID. Every order is evaluated independently and
is not split or deducted from another order's remaining capacity. Exclusions are
not stored `DeferralReason` decisions. An empty candidate list creates no deferral.

No matching orders returns `items: []`, `total: 0` and the depot's vehicles.
An offset beyond the page range keeps the full total/vehicle list. No vehicles
returns empty candidates and exclusions for each order. More than 500 depot
vehicles returns 422 with `Compatibility preview supports at most 500 vehicles
per depot`; vehicles are never silently truncated. At most 50,000 pairs are
evaluated in one API response.

`is_complete_plan_validation` is always false: candidates may still fail combined
trip capacity, windows, distance/sequencing, weekly fuel/reservations, or trip
limits. No complete served/deferred accounting is performed. Fuel data and saved
trip counts are not consulted. For example, two orders can both fit individually
while exceeding capacity together; a zero-quota vehicle can pass these checks.

This is an advisory live read, not a transactionally consistent solver input
snapshot, a reservation, or a saved-revision view. Reads/pages can observe
concurrent input changes. Revalidate complete inputs during allocation/publishing.
No existing plan/revision/order or fleet input is changed, and no trips/results
are written. Successful responses use `Cache-Control: no-store`. Database failures
return `503 {"detail":"Compatibility preview unavailable"}` without SQL details.
Invalid IDs/pagination return 422; existing authentication failures apply.

Shared exports: `CompatibilityIssue`, `VehicleExclusionResponse`,
`OrderCompatibilityResponse`, `CompatibilityVehicleResponse`, `PlanCompatibilityResponse`.
This increment adds no migration; apply `0007_fleet_operations` for availability.

## Draft optimization and saved results

```text
POST /api/v1/plans/{plan_id}/optimize
GET  /api/v1/plans/{plan_id}/revisions/{revision_id}/results
```

Both require active Dispatcher authentication and current plan depot access.
Foreign/missing plan IDs return 404. The POST accepts:

```json
{
  "request_id": "<new UUID for this run; preserve for retries>",
  "source": "Synthetic demo travel matrix",
  "is_synthetic": true,
  "services": [{"outlet_id":"<eligible outlet UUID>","service_seconds":600}],
  "shifts": [{
    "vehicle_id":"<available vehicle UUID>",
    "earliest_departure":"2026-10-05T07:30:00+05:30",
    "latest_return":"2026-10-05T18:00:00+05:30",
    "turnaround_seconds":900
  }],
  "legs": [
    {"from_outlet_id":null,"to_outlet_id":"<outlet UUID>","distance_km":"5.000","travel_seconds":900},
    {"from_outlet_id":"<outlet UUID>","to_outlet_id":null,"distance_km":"6.000","travel_seconds":1000}
  ]
}
```

Dates/IDs above are illustrative. Use the selected plan's date and live IDs, not
IDs from the standalone routing fixture. Each eligible outlet needs one service
entry. Each explicitly available depot vehicle needs one shift. Include every
directed pair among eligible outlets and the depot, without self legs; reverse
journeys are separate and null means depot. An empty eligible day uses empty
services/shifts/legs. Extra fields, duplicates and foreign/unknown resource inputs
are rejected. Source is required, at most 200 characters; synthetic must be boolean.
Travel and scheduling numeric/time limits match the internal route input format.

The server loads **all CONFIRMED orders** for the accepted plan date/depot. Clients
cannot submit selected order IDs, capacities, windows, availability, quotas or fuel
totals. Record plan-day availability for every depot vehicle first. For available
vehicles, daily consumed-fuel records are required for every day from Monday through
today within the plan week, including explicit zeros. A wholly future week has
zero consumption to date. Fuel reservations of published trips dated today or later
in that week are added to consumption; a published trip without a reservation (data
created outside the publish API) is rejected with 409. Shifts cannot start before the request's server clock.
Unknown data produces 422, not invented deferrals. Past plans and new runs on
published plans are rejected; earlier successful retries still replay.

Success creates a **new draft revision** (normally revision 2 after empty workspace
revision 1), without replacing older results. Response includes:

- `request_id`, `plan_id`, `revision_id`, `revision_number`, `created_at`.
- `source`, `is_synthetic`, `eligible_order_count`.
- `validation: "VALIDATED_SNAPSHOT"`, `publishable: false`,
  `algorithm: "capacity_then_bounded_insertion"`.
- `trips`: saved trip `id`, `vehicle_id`, chronological `trip_number`, timezone-aware
  departure/return timestamps, three-decimal distance/fuel strings and ordered stops.
- Each stop has saved `id`, `outlet_id`, `sequence_number`, `order_ids`, actual
  `arrival_at`, `service_start_at` (after waiting) and `departure_at`.
- `deferrals`: `order_id`, `outlet_id`, `reason_code`, `reason_text` for every
  unserved order. Every eligible order is served or deferred exactly once.

The independent validator recomputes compatibility, weight/volume, stop travel and
service windows, day availability, return/turnaround, two trips and weekly fuel,
and exact order coverage against the saved input snapshot. This does not validate
future live changes or operational reservations and is not permission to publish.
The bounded insertion fallback is a heuristic, not a global optimality guarantee.
Deferral text states the local-placement limitation; another allocation may differ.
No live order status, availability, consumed fuel, driver assignment or publication
state changes. Successful responses carry `Cache-Control: no-store` and a Location
pointing to the saved GET endpoint. GET returns the original result even after
live inputs change; it does not rerun the optimizer or show current trip execution.

| Status | Meaning |
|---|---|
| 201 | First successful run: all revision, route, assignment, reason and snapshot rows committed together. |
| 200 | Same request UUID and validated payload replay the original saved response. |
| 401 / 403 | Missing/inactive authentication / missing Dispatcher role. |
| 404 | Inaccessible/missing plan, or requested revision has no optimization result. |
| 409 | Key reused with different inputs/another plan, publication conflict, or insert conflict. |
| 422 | Missing/invalid inputs, incompatible calendar, past departure/date, or size limit. |
| 503 | Database/solver unavailable, search budget exhausted, or independent validation failed. Retry with the same request ID. |

Failed transactions are rolled back where possible. A lost database commit
acknowledgement can leave an uncertain outcome; same-key replay recovers that result.
Request IDs are globally unique. Preserve the exact payload/key after an uncertain
network outcome; retrying it cannot create a second revision. A deliberate new run
uses a new key and reloads current inputs. PostgreSQL locks the scoped plan, then
the depot, followed by orders/outlets and sorted fleet rows through commit. Same
plan requests serialize revision numbering; different plan dates in a depot also
serialize to avoid shared-outlet lock ordering conflicts. Fleet-input writes share
the vehicle locks. SQLite does not provide this concurrency guarantee. Serialization
does not prevent every unrelated insert/grant change, so publication must reload
the current eligible order set and revalidate. Other database deadlocks return the
sanitized 503; retry the same key after the conflict clears.

Limits: 100 eligible orders, 20 depot vehicles, 100 service entries, 20 shifts,
10,100 legs; route groups still permit at most 25 outlet visits and 20,000 arcs.
Search uses a 20-second elapsed budget checked between calls and at most 128 route
evaluations, with up to three seconds for initial capacity and two per route call.
Model construction/validation/database time can add latency. An exhausted search
returns 503 with no new revision rather than inventing unexplored deferrals.

Shared exports: `OptimizeRequest`, `OptimizationResponse`, `SavedTripResponse`,
`SavedStopResponse`, `DeferredOrderResponse`. Frontend example:

```typescript
const saved = await api.requestWithMetadata<OptimizationResponse>(
  `/plans/${planId}/optimize`, { method: 'POST', body: JSON.stringify(request) }
);
// Keep request.request_id and request unchanged while retrying.
// Display saved.data.trips and saved.data.deferrals, including synthetic provenance.
```

## Publishing and driver assignment

```text
POST /api/v1/plans/{plan_id}/revisions/{revision_id}/publish
GET  /api/v1/plans/{plan_id}/publication
```

Both require active Dispatcher authentication and current plan depot access; other
plans return 404. The revision must belong to the plan and have a saved optimization
result (otherwise 404). The POST accepts only:

```json
{
  "request_id": "<new UUID; preserve for retries>",
  "driver_assignments": [{"trip_id": "<saved trip UUID>", "driver_id": "<user UUID>"}]
}
```

Every saved trip needs exactly one entry (at most 40); a revision with no trips uses
`[]`. Each driver must be an active `DRIVER` assigned to the plan depot through
`user_depots`. A driver may take several trips that do not overlap in time.

The server never trusts the saved optimization as current. It locks the plan, depot,
eligible orders/outlets, depot vehicles and drivers, then rebuilds inputs from
**current** confirmed orders, outlet windows, vehicle capacities/types, plan-day
availability, km/l, weekly quota, consumed fuel (Monday through today, rows required)
and reservations. Only the saved travel legs, service durations and shifts are reused.
The saved schedule must pass the independent validator against those inputs, covering
every currently confirmed order exactly once. It also checks other effective
published trips from the previous, same and next day: no vehicle or driver overlap and
at most two trips per vehicle departing on the plan date. Any departure before the
server time, or a past plan date, is rejected.

Success commits in one transaction: revision and plan become `PUBLISHED` with
`published_at`; trips receive drivers; one fuel reservation per trip is stored; served
orders become `PLANNED` and deferred orders `DEFERRED`. Trip status stays `PLANNED`.
The saved optimization result is not changed (its `publishable: false` describes the
draft snapshot). Response (`201`, or `200` for a replay):

```typescript
interface PublicationResponse {
  request_id: string; plan_id: string; revision_id: string; revision_number: number;
  published_at: string; published_by: string;
  validation: 'REVALIDATED_AT_PUBLISH';
  served_order_count: number; deferred_order_count: number;
  trips: { trip_id: string; vehicle_id: string; trip_number: number; driver_id: string;
           departure_at: string; return_at: string; fuel_l: string }[];
  fuel_balances: { vehicle_id: string; week_start: string; weekly_quota_l: string;
                   consumed_l: string; reserved_l: string; remaining_l: string }[];
}
```

`fuel_balances` covers vehicles used by the revision at publication time; `reserved_l`
includes this revision. Balance = quota - consumed - reservations for trips dated today
or later. Earlier days use consumed totals, so reservations are never released; today's
reservations can double count fuel already in today's total (conservative).
`GET .../publication` returns the saved response, or 404 when unpublished.

| Status | Meaning |
|---|---|
| 201 / 200 | Published / same key and payload replayed. |
| 401 / 403 | Missing or inactive authentication / missing Dispatcher role. |
| 404 | Inaccessible plan, or revision without an optimization result in this plan. |
| 409 | Plan already published, key reused differently, inputs changed since optimization (`run a new optimization`), departure passed, vehicle/driver overlap, third trip, or published work without a reservation/snapshot. |
| 422 | Invalid body, missing/extra trip assignments, ineligible driver, a driver's own trips overlapping, past plan date, or missing consumed-fuel rows. |
| 503 | Database unavailable; retry with the same request ID. |

One published revision per plan is enforced by a partial unique index. Republishing,
superseding or editing a published plan is not implemented. Loader, Driver and Store
reads of published trips arrive in later increments. All responses use
`Cache-Control: no-store`; POST success sets `Location` to the GET endpoint.
Shared exports: `PublishRequest`, `PublicationResponse`, `PublishedTripResponse`,
`FuelBalanceResponse`.

## Loader

```text
GET  /api/v1/loader/trips
GET  /api/v1/trips/{trip_id}/loading
POST /api/v1/trips/{trip_id}/load-events
POST /api/v1/trips/{trip_id}/ready
```

## Driver

```text
GET  /api/v1/driver/trips
GET  /api/v1/trips/{trip_id}
POST /api/v1/trips/{trip_id}/start
POST /api/v1/sync/events
POST /api/v1/trips/{trip_id}/stops/{stop_id}/pod
```

## Shared statuses

Order:
```text
CONFIRMED
PLANNED
DEFERRED
LOADING
OUT_FOR_DELIVERY
DELIVERED
RECEIPT_CONFIRMED
```

Trip:
```text
PLANNED
LOADING
READY
IN_PROGRESS
COMPLETED
```

Plan/revision:
```text
DRAFT
PUBLISHED
```

Trip stop storage (no delivery transitions yet):
```text
PLANNED
ARRIVED
DELIVERED
FAILED
```

`PlanStatus` and `StopStatus` join `TripStatus` in shared types and are re-exported
by `@waypoint/api-contracts`. These enums specify stored values, not permission
to perform a transition. Plan workspace response DTOs are defined above.

Planning outcome storage exports `AssignmentOutcome` (`SERVED` or `DEFERRED`)
and `DeferralReason` from shared types and re-exports them via the API contract
package. `SERVED` means assigned to a stop in a revision, not delivered. Reason
codes are `NO_COMPATIBLE_VEHICLE`, `REEFER_CAPACITY_EXHAUSTED`,
`VAN_CAPACITY_EXHAUSTED`, `WEIGHT_CAPACITY`, `VOLUME_CAPACITY`, `TIME_WINDOW`,
`FUEL_QUOTA`, `VEHICLE_UNAVAILABLE`, `TRIP_LIMIT`. These are storage contracts;
draft optimization writes complete outcomes and reasons; publication revalidates them
against current inputs and moves orders to `PLANNED`/`DEFERRED`.

Sync:
```text
PENDING
SYNCING
SYNCED
FAILED
```
