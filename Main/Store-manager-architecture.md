# Store Manager Architecture — Final

**Owners:** Adrian, Abish  
**Backend support:** Loheeshan, Krish

## Platform
Next.js responsive web application.

## Must-have flow

```text
Orders
 -> New Order
 -> Confirmation
 -> Planned / Deferred
 -> Delivery Status
 -> Confirm Receipt
```

## Backend calls

```text
GET  /store/orders
POST /store/orders
GET  /store/orders/{id}
POST /store/orders/{id}/receipt
```

## Cutoff

The booklet states next-day orders close at 4 PM.

UI must clearly show whether:
- accepted for next-day planning;
- after cutoff and moved to next run.

## Deferral

Show:
```text
Deferred
Reason
Next action
```

No vague "optimization failed" message.

## Branches

```text
feature/store-orders
feature/store-create
feature/store-confirmation
feature/store-status
feature/store-deferral
feature/store-receipt
```

## Definition of done

- order can be submitted;
- status changes after Dispatcher publish;
- deferred reason visible;
- delivery completion visible;
- receipt can be confirmed.
