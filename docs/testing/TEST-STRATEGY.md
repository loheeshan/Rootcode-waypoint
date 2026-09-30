# Test Strategy

## Backend unit tests

```text
auth role guards
weight capacity
volume capacity
reefer compatibility
van-only restriction
home depot
delivery windows
fuel quota
max two trips
served/deferred
sync idempotency
```

## Integration tests

```text
store order -> dispatcher queue
plan optimize -> assignments
publish -> loader trip
loader ready -> driver trip
driver delivery -> store status
store receipt -> dispatcher completion
```

## Web E2E

```text
store-order.spec.ts
dispatcher-plan.spec.ts
dispatcher-overcapacity.spec.ts
store-receipt.spec.ts
role-access.spec.ts
```

## Driver mobile

```text
trip persists locally
offline completion persists
outbox survives restart
duplicate event idempotent
POD retry works
reconnect sync works
```

## Loader mobile

```text
assigned trip appears
load event persists
shortfall persists offline
shortfall syncs
ready updates Driver
```

## Release smoke flow

```text
Store order
-> Dispatcher plan/publish
-> Loader shortfall/ready
-> Driver offline delivery
-> reconnect
-> Store receipt
-> Dispatcher completion
```
