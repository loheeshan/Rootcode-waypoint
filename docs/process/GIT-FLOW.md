# Git Flow

## Permanent branches

```text
main
└── dev
```

## Phase 1 — foundation branches

Create and merge in this order:

```text
1. chore/repository-foundation
2. feature/design-tokens
3. feature/web-design-system
4. feature/mobile-design-system
5. feature/api-contracts
6. feature/database-foundation
7. feature/auth-foundation
```

## Phase 2 — feature branches

### Dispatcher
```text
feature/dispatcher-dashboard
feature/dispatcher-orders
feature/dispatcher-planning
feature/dispatcher-plan-results
feature/dispatcher-deferrals
feature/dispatcher-publish
feature/dispatcher-operations
```

### Store Manager
```text
feature/store-orders
feature/store-create-order
feature/store-confirmation
feature/store-delivery-status
feature/store-deferral
feature/store-receipt
```

### Driver
```text
feature/driver-auth
feature/driver-trip-list
feature/driver-trip-overview
feature/driver-stop-flow
feature/driver-pod-ui
feature/driver-sqlite
feature/driver-outbox
feature/driver-sync
feature/driver-api-integration
```

### Loader
```text
feature/loader-auth
feature/loader-trip-list
feature/loader-loading
feature/loader-shortfall
feature/loader-damage
feature/loader-sqlite
feature/loader-sync
feature/loader-api-integration
feature/loader-ready
```

### Backend
```text
feature/api-orders
feature/api-fleet
feature/api-loading
feature/api-delivery
feature/api-receipts
feature/api-mobile-sync
```

### Planning
```text
feature/planning-compatibility
feature/planning-allocation
feature/planning-validator
feature/planning-deferrals
```

## Developer flow

```bash
git checkout dev
git pull origin dev
git checkout -b feature/store-create-order
```

After work:

```bash
git status
git diff
git add apps/web/app/store
git commit -m "feat(store): add order creation flow"
```

Run tests and Development Guardian.

```bash
git push -u origin feature/store-create-order
```

PR:
```text
feature/store-create-order -> dev
```

## Daily merge rhythm

Morning:
- pull `dev`
- create fresh branch

Afternoon:
- check API/schema changes

Evening:
- review and merge ready PRs
- run full smoke flow

## Feature freeze

Allowed:
```text
fix/*
docs/*
test/*
```

No major new features.

## Release

```text
dev
-> full smoke test
-> fresh Docker
-> seeded judge walkthrough
-> PR to main
-> v1.0.0-hackathon-submission
```
