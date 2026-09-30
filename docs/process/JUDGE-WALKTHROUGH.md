# Judge Walkthrough

## Seed users

```text
dispatcher@waypoint.demo
store@waypoint.demo
loader@waypoint.demo
driver@waypoint.demo
```

## 1. Store Manager
1. Login.
2. Create order.
3. Submit.
4. Verify `CONFIRMED`.

## 2. Dispatcher
1. Login.
2. Open confirmed orders.
3. Run allocation.
4. Review served/deferred.
5. Verify zero hard-rule violations.
6. Review a deferral reason.
7. Publish plan.

## 3. Loader
1. Login in mobile app.
2. Open assigned trip.
3. Review loading sequence.
4. Record one shortfall/damage event.
5. Verify Dispatcher receives it.
6. Complete loading.
7. Mark trip `READY`.

## 4. Driver
1. Login in mobile app.
2. Open trip.
3. Disable network.
4. Complete first stop.
5. Capture POD.
6. Verify `Pending sync`.
7. Restore network.
8. Verify `Synced`.

## 5. Store Manager
1. Open delivered order.
2. Confirm receipt.

## 6. Dispatcher
1. Open operations view.
2. Verify trip, delivery and receipt completion.
