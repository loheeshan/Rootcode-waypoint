# API Contracts

## Implementation status

Authentication, Store order create/list/detail, Dispatcher order listing, fleet
reads, daily fleet input GET/PUT, and plan create/list/detail routes are implemented. Store receipt,
optimization, publishing, live operations, Loader and Driver routes remain planned.
Migration `0005_planning_foundation` adds storage for plans, revisions, trips and
stops. Plan workspace APIs now use this storage; allocation/publishing remain pending.
Migration `0006_plan_outcomes` adds order result and deferral reason storage,
without new routes or changes to existing order JSON/status behavior.
Migration `0007_fleet_operations` adds daily availability and fuel-usage storage.
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
The read APIs need no additional migration. Optimization, publishing, live
operations and frontend screen integration remain future increments.

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
Optimization, result details, revision creation/editing and publishing are later
increments. A `PUBLISHED` value read from storage is not a new validation verdict.

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
optimization, complete outcome coverage, reason generation and publishing
validation remain pending.

Sync:
```text
PENDING
SYNCING
SYNCED
FAILED
```
