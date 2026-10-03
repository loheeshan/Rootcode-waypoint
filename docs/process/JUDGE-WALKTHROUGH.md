# Judge Walkthrough

## Seed users

Create these accounts with the [demo seed command](../../apps/api/app/auth/README.md#create-demo-accounts)
and use the password entered at its secure prompt. No default password is supplied.
Re-running the command preserves existing accounts and their original passwords.
Then run the [demo resource seed](../../apps/api/app/fleet/README.md#synthetic-demo-data)
to create the synthetic depot, outlets, vehicles and demo account assignments.
It does not create orders or trips. The Store Manager is assigned only to the
demo store; the Dispatcher, Loader and Driver receive the demo depot assignment.

```text
dispatcher@waypoint.demo
store@waypoint.demo
loader@waypoint.demo
driver@waypoint.demo
```

Login, `/me`, Store order create/list/detail, Dispatcher order listing and fleet
reads are implemented and can be exercised through the API docs. Store creation
applies the 16:00 Colombo cutoff; the response explains a date adjustment and the
stored date is the accepted date. After creating an order, authorize as the demo
Dispatcher and query `/api/v1/dispatcher/orders?status=CONFIRMED` with that accepted
date. The same ID/quantities appear with outlet/depot details. `/api/v1/fleet`
returns two demo vehicles and one depot. Both reads are restricted to assigned
depots; availability and remaining fuel are not yet computed. Create a draft plan
with `POST /api/v1/plans` using the assigned depot ID and the order's accepted date.
List plans, open its ID, and verify the empty draft revision 1. Creating the same
depot/date again returns 409 with the existing plan's Location. Plan detail reports
saved revision counts, not optimization success. Frontend integration, allocation,
publishing, loading, delivery and receipt steps remain planned.

Apply migration `0007_fleet_operations` before testing the current backend. It
adds empty daily vehicle availability/fuel tables without changing the API
walkthrough. Demo resources have no daily operational inputs yet; missing rows
mean unknown. Input endpoints and planner enforcement remain future increments.

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
