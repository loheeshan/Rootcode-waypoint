# API Contracts

## Foundation implementation status

The endpoints below are the planned business API, not implemented routes. The
repository foundation currently exposes only `GET /health`, `GET /ready`, and
the same checks under `/api/v1`. Health returns `status`, `service`, and `version`;
readiness returns 200 when PostgreSQL is reachable and 503 otherwise. Domain
payload schemas and authentication will be added in the contract/auth branches.

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
