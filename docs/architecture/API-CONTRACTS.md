# API Contracts

## Implementation status

Authentication, Store order create/list/detail, Dispatcher order listing, fleet
reads, daily fleet input GET/PUT, plan create/list/detail, plan publishing, Loader and
Driver routes, Store receipt confirmation and offline sync are implemented. Live
operations remain planned.
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
Migration `0010_load_events` adds append-only loading events and trip readiness records.
Migration `0011_delivery_events` adds Driver delivery events and proof-of-delivery photos.
Migration `0012_receipt_confirmations` adds Store receipt records.
Migration `0013_sync_events` adds batch-sync receipts.
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
GET  /api/v1/store/orders/{order_id}/receipt
```

All Store routes are implemented, including receipt confirmation below.
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
list first. Order creation has no idempotency key; receipt confirmation below does.
Shared types are `OrderCreateRequest`, `OrderResponse`,
`OrderCreateResponse` and `OrderListResponse` in `@waypoint/api-contracts`.

### Receipt confirmation

`POST /api/v1/store/orders/{order_id}/receipt` accepts only
`{"request_id":"<client UUID>"}`. `GET` on the same path returns the saved receipt.
Both require an active `STORE_MANAGER` whose current `user_outlets` include the
order's outlet; the order is selected through that assignment in SQL, so missing,
other-outlet and revoked orders return `404 {"detail":"Order not found"}`.

Confirmation is allowed only when the order is `DELIVERED` **and** the Driver's
`DELIVERED` event exists for the stop serving it in the plan's effective published
revision. It atomically stores the receipt (request ID, order, outlet, delivery
event, confirming user, server time) and moves the order
`DELIVERED -> RECEIPT_CONFIRMED`. Orders at failed stops (`OUT_FOR_DELIVERY`), and
`CONFIRMED`, `PLANNED`, `DEFERRED` or `LOADING` orders, return 409
`Only delivered orders can be confirmed as received`. A `DELIVERED` order without a
delivery record returns 409 `No delivery record exists for this order`.

`ReceiptResponse`: `request_id`, `order_id`, `outlet_id`, current `order_status`,
`delivery_event_id`, `delivered_at` (Driver time, else server record time),
`confirmed_by`, `confirmed_at`. Status codes: 201 created (with `Location`), 200 when
the same `request_id` is replayed for the same order, 409 when the order already has
a receipt under another request ID or the request ID belongs to another order, 404
when `GET` finds no receipt, 422 for invalid bodies, 503 sanitized database errors.
The order row lock and a unique order key prevent duplicate receipts under
concurrency. The supplied specifications define no discrepancy fields, so none are
stored; quantity/damage disputes are not part of this endpoint.

The status change is visible through the existing Store list/detail
(`status=RECEIPT_CONFIRMED` filter) and the Dispatcher order queue. Shared types:
`ReceiptRequest`, `ReceiptResponse`.

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
**Operational requirement:** once a day ends, its consumed total must be final. A
reservation stops counting the day after its trip, so a partial total recorded early
(for example `0` before departure) would under-count weekly fuel.
Saved deferral reasons are published as explained at optimization time; they are
not recomputed against current inputs. The optimizer does not yet block shifts that
overlap another plan's published trip (e.g. an overnight return); such a revision is
rejected at publish with 409, so adjust the shift and re-optimize.
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

All four require an active `LOADER` and the trip's plan depot in the caller's current
`user_depots`. Scope is applied in SQL on every request, so revocation is immediate.
Only trips of each plan's **effective published revision** (the one referenced by
`plan_publications`) are visible; draft, unpublished, foreign and missing trips return
`404 {"detail":"Trip not found"}`. Responses use `Cache-Control: no-store`.

Orders have no product lines, so loading is recorded **per assigned order** as
`LOADED`, `MISSING` or `DAMAGED` (`LoadStatus`); no quantities or units are invented.

`GET /loader/trips` accepts optional `delivery_date`, `status` (`TripStatus`), `limit`
(1-100, default 20) and `offset`; it sorts by delivery date descending, then vehicle,
trip number and ID. Items (`LoaderTripResponse`) carry the trip, plan, depot, date,
vehicle, trip number, assigned driver, status, published departure/return and stop
and order counts.

`GET /trips/{id}/loading` (`TripLoadingResponse`) returns that summary, stops in
`sequence_number` order, each stop's assigned orders (order status, temperature,
three-decimal weight/volume, current `load_status`, `note`, `last_event_id`),
counts of loaded/missing/damaged/pending orders, `last_event_sequence` and the
readiness `completion` (or null).

`POST /trips/{id}/load-events` accepts one event:

```json
{"event_id":"<client UUID>","order_id":"<UUID>","status":"DAMAGED",
 "note":"Crushed carton","occurred_at":"2026-10-05T06:40:00+05:30"}
```

`note` is optional for `LOADED` and required (non-blank, at most 500 characters) for
`MISSING`/`DAMAGED`. `occurred_at` is optional, timezone-aware, stored in UTC and at
most five minutes ahead of the server. The order must be a `SERVED` assignment of
that trip (otherwise 422). Events are append-only; a later event for the same order
supersedes the earlier one. The server assigns a gap-free per-trip `sequence_number`.
The first event moves the trip `PLANNED -> LOADING` and its `PLANNED` orders to
`LOADING`. Response `LoadEventResponse`: 201 new, 200 when the same `event_id` and
payload are replayed (even after the trip is ready). A reused `event_id` with
different data or on another trip returns 409. Events after the trip leaves `LOADING`
return 409 `Loading is finalized for this trip`.

`POST /trips/{id}/ready` accepts `{"request_id":"<UUID>","last_event_sequence":3}`.
**Readiness requirements**, all checked under the trip row lock:

1. The trip is `LOADING` (a `PLANNED` trip has no events and fails rule 2).
2. `last_event_sequence` equals the trip's latest sequence, proving the Loader
   reviewed the current state; otherwise 409 `Loading changed ... retry`.
3. Every `SERVED` order on the trip has a current outcome (none pending).
4. At least one order is currently `LOADED`.

`MISSING`/`DAMAGED` outcomes are allowed and stay visible as exceptions with notes.
Success sets the trip `READY`, stores a `trip_loading_completions` record (request ID,
sequence and counts) and returns 201 with the loading view. The same request ID and
sequence replay 200; a reused ID with other data, or another ID after readiness,
returns 409. `READY` is final for loading: no further events or reversal.

Load events and ready requests lock the trip row, so a concurrent event either
commits first (making the ready request's sequence stale) or is rejected after
readiness. Route stops, driver assignments and fuel reservations are never changed.
Missing/damaged orders keep order status `LOADING`; their delivery outcome belongs
to the Driver/Dispatcher batches. 503 responses hide database details; retry with
the same ID. Status codes: 401/403 authentication/role, 404 scope, 409 conflicts
above, 422 invalid body, order or time.

Offline-sync notes: the current outcome is the event with the highest server
sequence, so **last arrival wins**, not latest `occurred_at`; the ready check makes a
human review that state before confirming. Replays match on event ID and payload,
with `occurred_at` compared as an instant (any offset); a replay returns the current
`trip_status`, so outboxes should compare status codes and IDs, not whole bodies. A
replay after depot access is revoked returns 404; treat 404/401/403/422 as terminal
rather than retrying forever. The offline-sync batch may refine these rules.

Shared exports: `LoadStatus`, `LoaderTripResponse`, `LoaderTripListResponse`,
`TripLoadingResponse`, `LoadingStopResponse`, `LoadingOrderResponse`,
`LoadingCompletionResponse`, `LoadEventRequest`, `LoadEventResponse`, `TripReadyRequest`.

## Driver

```text
GET  /api/v1/driver/trips
GET  /api/v1/trips/{trip_id}
POST /api/v1/trips/{trip_id}/start
POST /api/v1/trips/{trip_id}/stops/{stop_id}/arrive
POST /api/v1/trips/{trip_id}/stops/{stop_id}/pod
GET  /api/v1/trips/{trip_id}/stops/{stop_id}/pod
POST /api/v1/trips/{trip_id}/stops/{stop_id}/deliver
POST /api/v1/trips/{trip_id}/stops/{stop_id}/fail
POST /api/v1/trips/{trip_id}/complete
POST /api/v1/sync/events            (batched offline sync, below)
```

Every Driver route requires an active `DRIVER` who is the trip's assigned
`driver_id`, whose `user_depots` still include the plan depot, on a trip of the
plan's effective published revision. Anything else returns `404 Trip not found`;
a stop outside the trip returns `404 Stop not found`. All responses use
`Cache-Control: no-store`.

`GET /driver/trips` takes `delivery_date`, `status`, `limit` (1-100) and `offset`, like
the Loader list, and returns `DriverTripListResponse` (`DriverTripResponse` has the
`LoaderTripResponse` fields). `GET /trips/{id}` returns `DriverTripDetailResponse`:
the summary, `last_event_sequence`, `started_at`, `completed_at` and stops in sequence
order. Each stop includes outlet brand/district/window, status, planned arrival,
`requires_visit`, arrival/outcome times, failure reason/note, POD metadata (never the
photo bytes) and orders with `load_status` and `deliverable`.

**Deliverable orders** are a trip's served orders whose final loading outcome is
`LOADED`. A stop **requires a visit** when it has at least one. `MISSING`/`DAMAGED`
orders are never delivered and keep order status `LOADING`.

Write bodies (`DeliveryEventRequest`): `{"event_id":"<client UUID>","occurred_at":null}`;
`occurred_at` is optional, timezone-aware and at most five minutes ahead.

| Endpoint | Allowed when | Effect |
|---|---|---|
| `start` | Trip `READY`, Colombo date on/after the delivery date, no other `IN_PROGRESS` trip for this driver or vehicle | Trip `IN_PROGRESS`; deliverable orders `LOADING -> OUT_FOR_DELIVERY`. |
| `arrive` | Trip `IN_PROGRESS`, stop `PLANNED`, requires a visit, no other stop `ARRIVED` | Stop `ARRIVED`. Stops may be visited in any order, one at a time. |
| `pod` | Trip `IN_PROGRESS`, stop `ARRIVED`, no POD yet | Stores proof of delivery (below). |
| `deliver` (`pod_id` required) | Stop `ARRIVED`; `pod_id` is this stop's POD | Stop `DELIVERED`; deliverable orders `OUT_FOR_DELIVERY -> DELIVERED`. |
| `fail` (`reason_code`, `note` required) | Stop `PLANNED` or `ARRIVED`, requires a visit | Stop `FAILED`; orders stay `OUT_FOR_DELIVERY`, never `DELIVERED`. |
| `complete` | Every stop requiring a visit is `DELIVERED` or `FAILED` | Trip `COMPLETED`. |

Failure reasons (`DeliveryFailureReason`): `OUTLET_CLOSED`, `RECEIVER_UNAVAILABLE`,
`ACCESS_BLOCKED`, `DELIVERY_REFUSED`, `VEHICLE_ISSUE`, `OTHER`. The note (1-500
characters, not blank) is the required failure evidence; a photo is not required for
failures. Partial delivery of a stop is not supported: orders are whole consignments,
and a stop is delivered or failed as one unit. Re-planning failed orders and
reconciling missing/damaged orders belong to the Dispatcher operations batch.

Responses (`DeliveryEventResponse`) include the event, its per-trip
`sequence_number` and the current trip/stop status: 201 for a new event, 200 when
the same `event_id` and payload (same endpoint, trip and stop; `occurred_at`
compared as an instant) are replayed, even after later transitions. A reused
`event_id` with different data returns 409. Transitions that are not allowed
return 409; invalid bodies, reasons or times return 422. The database allows one
start, one completion, one arrival and one outcome per stop.

**Proof of delivery.** `POST .../pod` accepts JSON (no multipart dependency):

```json
{"pod_id":"<client UUID>","receiver_name":"Nimal Perera",
 "photo_mime_type":"image/jpeg","photo_base64":"<base64>","captured_at":null}
```

Request bodies over 1,500,000 bytes (declared `Content-Length` or streamed size) are
rejected with 413 before parsing. Only `image/jpeg` and `image/png` are accepted. The decoded photo must be 1 to
1,000,000 bytes and its leading bytes must match the declared type; otherwise 422.
Compress on the device first. Bytes are stored in PostgreSQL `BYTEA` with size and
SHA-256. One POD per stop: the same `pod_id` and content replay 200 (`PodResponse`),
different content or a second POD return 409. `GET .../pod` returns the raw image
with its content type, `X-Content-Type-Options: nosniff` and `no-store`; it is
allowed for the assigned Driver and for Dispatchers with depot access (404 otherwise).

Every write locks the trip row (then the stop and orders), so concurrent
transitions serialize; for example, concurrent deliver and fail on one stop yield
one 201 and one 409. Route stops' outlets/sequence, driver assignments and fuel
reservations are not changed. 503 responses hide database details; retry with the
same ID. For offline outboxes, 409 means the request conflicts with current state
(reload the trip; never resend it unchanged), and 401/403/404/413/422 are terminal for
that payload. `occurred_at` is client time for display only; server `recorded_at` and
`sequence_number` are authoritative. A POD may remain on a stop later marked `FAILED`
(for example, a refusal after the photo); it is kept as evidence. After completion,
orders of failed stops stay `OUT_FOR_DELIVERY` and missing/damaged orders stay
`LOADING` until the Dispatcher operations batch resolves them; clients must not read
`OUT_FOR_DELIVERY` on a `COMPLETED` trip as en route.

Shared exports: `DeliveryEventType`, `DeliveryFailureReason`, `DriverTripResponse`,
`DriverTripListResponse`, `DriverTripDetailResponse`, `DriverStopResponse`,
`DriverOrderResponse`, `PodResponse`, `PodUploadRequest`, `DeliveryEventRequest`,
`DeliverRequest`, `FailRequest`, `DeliveryEventResponse`.

## Offline synchronization

```text
POST /api/v1/sync/events
```

Requires an active `DRIVER` or `LOADER`. Each event is applied by the same service
as its REST endpoint, so role, current depot access, Driver assignment, trip/stop/order
ownership, readiness and POD rules are rechecked for every event, **including
replays**. Identity comes only from the bearer token; `device_id` is stored for
tracing and `occurred_at` values are display-only.

```json
{
  "device_id": "driver-phone-7f3a",
  "events": [
    {"event_id": "<UUID>", "type": "TRIP_STARTED", "trip_id": "<UUID>", "payload": {}},
    {"event_id": "<UUID>", "type": "STOP_ARRIVED", "trip_id": "<UUID>", "stop_id": "<UUID>",
     "payload": {"occurred_at": "2026-10-05T08:02:00+05:30"}},
    {"event_id": "<UUID>", "type": "STOP_DELIVERED", "trip_id": "<UUID>", "stop_id": "<UUID>",
     "payload": {"pod_id": "<UUID already uploaded via POST .../pod>"}}
  ]
}
```

| `type` | Role | Payload (REST body without its ID) | Equivalent REST call |
|---|---|---|---|
| `LOAD_RECORDED` | Loader | `order_id`, `status`, `note?`, `occurred_at?` | `POST /trips/{id}/load-events` |
| `TRIP_READY` | Loader | `last_event_sequence` | `POST /trips/{id}/ready` (`request_id` = `event_id`) |
| `TRIP_STARTED` | Driver | `occurred_at?` | `POST /trips/{id}/start` |
| `STOP_ARRIVED` | Driver | `occurred_at?` (needs `stop_id`) | `POST .../stops/{sid}/arrive` |
| `STOP_DELIVERED` | Driver | `pod_id`, `occurred_at?` (needs `stop_id`) | `POST .../stops/{sid}/deliver` |
| `STOP_FAILED` | Driver | `reason_code`, `note`, `occurred_at?` (needs `stop_id`) | `POST .../stops/{sid}/fail` |
| `TRIP_COMPLETED` | Driver | `occurred_at?` | `POST /trips/{id}/complete` |

The envelope `event_id` becomes the domain ID; a payload containing that ID field is
rejected. POD photos are never embedded: upload them first with the POD endpoint
(itself idempotent by `pod_id`) and reference `pod_id`.

**Ordering and partial success.** A batch holds 1-50 events and is processed in
array order. Each event commits in its own transaction together with its
`sync_events` receipt, so earlier applied events stay applied if a later one fails.
After any event of a trip is not applied (rejected, conflict, retry), later events of
that trip in the same batch are `SKIPPED` (not attempted); other trips continue.
Send events oldest first in creation order; never reorder or merge them.

The endpoint returns 200 with one result per input event (same `index`). Only an
invalid envelope (missing/blank `device_id`, 0 or more than 50 events, extra fields)
returns 422, and authentication/role failures return 401/403 for the whole batch.

| `outcome` | `http_status` | Meaning / client action |
|---|---|---|
| `APPLIED` | 201 | New change committed; mark synced. `result` is the domain response. |
| `DUPLICATE` | 200 | Same `event_id` and equivalent payload already applied; mark synced. `result` shows **current** trip/stop status, not a historical copy. |
| `REJECTED` | 403/404/422 | Invalid payload, wrong role, or entity not accessible (including revoked access on replay). Do not resend unchanged; surface to the user. |
| `CONFLICT` | 409 | Stale state (e.g. ready with an old sequence, deliver before arrival or without POD, trip finalized) or the `event_id` was used with different data/type/user. Server state is not overwritten; reload the trip and let the user decide. |
| `RETRY` | 503 | Temporary database failure; nothing was committed. Resend the same event unchanged later. |
| `REJECTED` | 500 | Unexpected server error for this event (logged); nothing was committed. Do not loop; surface for support. |
| `SKIPPED` | 424 | Not attempted because an earlier event of this trip failed; resend after resolving it. |

An event whose envelope is invalid also blocks later events of its `trip_id` (when
that ID is readable). Use separate event IDs for REST calls and sync events: an ID
first used through REST has no sync receipt, and reusing it for another sync type
later makes the original resend return `CONFLICT`.

Equivalence: the receipt hash covers type, trip, stop and the validated payload
(with `occurred_at` compared as an instant). Receipts persist in PostgreSQL, so a
restarted app resending its outbox gets `DUPLICATE`. Concurrent duplicate
submissions serialize on the trip row lock and apply once; the unique receipt
`event_id` rolls back any second application. A whole-batch 503 means nothing after
the failure point is known; resend the batch unchanged.

**Frontend guidance.** Store each event with a UUID generated once, its exact
payload and `pending` status in Expo SQLite before updating the UI. On reconnect,
send pending events oldest first in batches of at most 50, mark
`APPLIED`/`DUPLICATE` as synced, keep `RETRY`/`SKIPPED` pending, and move
`REJECTED`/`CONFLICT` to a needs-attention state after refreshing the trip. The
mobile outbox, SQLite storage and NetInfo handling remain frontend work.

Shared exports: `SyncEventType`, `SyncOutcome`, `SyncEventRequest`, `SyncBatchRequest`,
`SyncEventResult`, `SyncBatchResponse`.

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
