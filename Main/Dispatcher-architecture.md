# Dispatcher Architecture — Final

**Owners:** Abish, Adrian  
**Backend support:** Loheeshan, Krish

## Platform
Next.js + React + TypeScript.

## Must-have screens

```text
1. Dashboard
2. Confirmed Orders
3. Planning Workspace
4. Allocation Result
5. Deferral Review
6. Publish Plan
7. Live Operations
```

## Main backend calls

```text
GET  /dispatcher/orders
GET  /fleet
POST /plans
POST /plans/{id}/optimize
GET  /plans/{id}
POST /plans/{id}/publish
GET  /operations/live
```

## Important UI validations

Display reason codes from backend:

```text
REEFER_REQUIRED
VAN_ONLY
WEIGHT_LIMIT
VOLUME_LIMIT
WINDOW
FUEL_QUOTA
TRIP_LIMIT
```

Do not duplicate planning logic in frontend.

## Branches

```text
feature/dispatcher-dashboard
feature/dispatcher-orders
feature/dispatcher-planning
feature/dispatcher-deferrals
feature/dispatcher-publish
feature/dispatcher-operations
```

## Recommended order

### Abish
```text
dashboard
planning
publish
```

### Adrian
```text
orders
deferrals
operations
```

Both integrate and review each other.

## Definition of done

- can open confirmed orders;
- optimize;
- see served/deferred;
- see zero hard violations;
- publish;
- Loader receives plan;
- Loader exception appears;
- Driver delivery status appears.
