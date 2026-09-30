# Dispatcher Architecture

Owners:
- Abish
- Adrian

Platform:
```text
Next.js + React + TypeScript
```

Screens:
```text
Dashboard
Confirmed Orders
Planning
Allocation Results
Deferral Review
Publish
Live Operations
```

Branches:
```text
feature/dispatcher-dashboard
feature/dispatcher-orders
feature/dispatcher-planning
feature/dispatcher-plan-results
feature/dispatcher-deferrals
feature/dispatcher-publish
feature/dispatcher-operations
```

Commits:
```text
feat(dispatcher): add dashboard metrics
feat(dispatcher): add confirmed order queue
feat(dispatcher): add planning workspace
feat(dispatcher): show allocation results
feat(dispatcher): add deferral review
feat(dispatcher): add publish confirmation
feat(dispatcher): add live operations
test(dispatcher): cover dispatcher walkthrough
```

API:
```text
GET /dispatcher/orders
GET /fleet
POST /plans
POST /plans/{id}/optimize
GET /plans/{id}
POST /plans/{id}/publish
GET /operations/live
```

Definition of Done:
- plan works
- served/deferred visible
- hard violations visible
- publish reaches Loader
- Loader exception returns
- Driver status appears
