# API Contracts

## Implementation status

Authentication routes below are implemented. Store, Dispatcher, Loader and
Driver business routes remain planned. The API also exposes `GET /health`,
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
trusted data setup assigns resources. A depot assignment does not implicitly
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
