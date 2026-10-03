# API Contracts

## Implementation status

Authentication, Store order create/list/detail, Dispatcher order listing and
fleet read routes are implemented. Store receipt, planning, live operations,
Loader and Driver business routes remain planned.
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
POST /api/v1/plans/{plan_id}/optimize
GET  /api/v1/plans/{plan_id}
POST /api/v1/plans/{plan_id}/publish
GET  /api/v1/operations/live
```

The first two routes are implemented and require bearer authentication plus
`DISPATCHER`. Both use current `UserDepot` assignments in SQL before counting or
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
No database migration is needed. Planning/publishing/live operations and
frontend screen integration remain future increments.

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

Sync:
```text
PENDING
SYNCING
SYNCED
FAILED
```
