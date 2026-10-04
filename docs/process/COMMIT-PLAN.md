# Commit Plan

## Backend delivery queue (2026-10-04)

This is the current implementation queue; the original feature lists below also
include completed work and frontend tasks. Use one reviewable commit per batch,
with `feature/` branches. The user commits and pushes after reviewing each batch.

**Completed:** draft optimization (`feature/planning-optimize-api`).

**Current batch (1):** `feature/planning-publish` — publish one effective revision
after revalidating current inputs; active depot Driver assignments; per-trip fuel
reservations used by optimization and publishing; vehicle/driver overlap and
two-trip day checks; `PLANNED`/`DEFERRED` order transitions; replay keys and
migration `0009_plan_publications`. Republishing a published plan is not included.

**Six backend batches remain after this commit (2–7):**

| Next | Suggested branch | Commit scope / completion check |
|---|---|---|
| 1 | `feature/planning-publish` | Publish one effective immutable revision; scoped active Driver assignments; authoritative reservation storage/balances; lock/revalidate operational trip limits and weekly fuel; order transitions and conflict tests. |
| 2 | `feature/loader-workflow` | Loading/event storage and scoped trip/loading APIs; shortfall/damage records; guarded loading-to-ready transition. |
| 3 | `feature/driver-delivery` | Assigned-trip/stop reads, guarded start/delivery/failure transitions; proof-of-delivery upload/read stored in PostgreSQL with authorization and size/type limits. |
| 4 | `feature/store-receipts` | Receipt storage; outlet-scoped receipt confirmation on delivered orders; duplicate protection and receipt status propagation. |
| 5 | `feature/offline-sync` | Idempotent event ingestion and persisted sync receipts; replay/conflict rules for Driver/Loader events; restart/retry/reconnect server tests. Mobile SQLite/outbox UI remains client work. |
| 6 | `feature/dispatcher-operations` | Depot-scoped live operation summaries, loading/delivery/receipt exceptions and persistent audit history. |
| 7 | `feature/backend-integration` | Complete synthetic operational seed data, Store-to-Dispatcher-to-Loader-to-Driver-to-Store API integration tests, contract verification and frontend connection walkthrough. |

These are planned batches, not a guaranteed fixed count; integration findings may
require fixes. The user approved clearly labelled synthetic route data, now included
as `data/seed/route-inputs.synthetic.json`. Real road data remains unavailable;
the demo snapshot is not automatically mapped to database IDs or used for publication.
The optimization service loads the whole eligible depot/day input set; publishing
must reload and revalidate it against current operational work and reservations.

Frontend connection can start now with auth, Store orders, Dispatcher orders,
fleet inputs, plan workspace, compatibility and saved optimization contracts.
Publishing, loading, delivery, receipts and sync need the batches above. Finishing
these backend batches does not itself implement or connect every frontend screen.

## Repository foundation

Branch:
```text
chore/repository-foundation
```

Commits:
```text
chore(repo): initialize monorepo structure
chore(repo): add workspace configuration
chore(repo): add environment templates
docs(repo): add contribution guidelines
ci(repo): add initial github actions workflow
```

## Design tokens

```text
feat(ui): add color tokens
feat(ui): add spacing and radius tokens
feat(ui): add typography tokens
feat(ui): expose shared status colors
```

## Web reusable components

```text
feat(web-ui): add button and input primitives
feat(web-ui): add modal and dropdown primitives
feat(web-ui): add status badge and pill components
feat(web-ui): add card and metric components
feat(web-ui): add data table and pagination components
feat(web-ui): add loading empty and error states
```

## Mobile reusable components

```text
feat(mobile-ui): add mobile button and input primitives
feat(mobile-ui): add screen header and bottom action
feat(mobile-ui): add trip and stop cards
feat(mobile-ui): add offline and sync status
feat(mobile-ui): add loading empty and error states
```

## API contracts

```text
feat(contracts): add authentication models
feat(contracts): add order models
feat(contracts): add plan trip and stop models
feat(contracts): add loading and delivery event models
feat(contracts): add receipt and sync models
```

## Database

```text
feat(db): add user and role tables
feat(db): add depot outlet and vehicle tables
feat(db): add order tables
feat(db): add planning and trip tables
feat(db): add loading delivery and receipt tables
feat(db): add sync and audit tables
```

## Auth

```text
feat(auth): add password hashing and login
feat(auth): add jwt role claims
feat(auth): add backend role guards
feat(auth): seed four demo accounts
test(auth): cover role access restrictions
```

## Dispatcher

```text
feat(dispatcher): add dashboard shell
feat(dispatcher): add confirmed order queue
feat(dispatcher): add planning workspace
feat(dispatcher): show allocation results
feat(dispatcher): add deferral review
feat(dispatcher): add publish confirmation
feat(dispatcher): add live operations view
test(dispatcher): cover planning walkthrough
```

## Store

```text
feat(store): add order list
feat(store): add new order form
feat(store): add cutoff-aware confirmation
feat(store): add delivery status
feat(store): add deferred order state
feat(store): add receipt confirmation
test(store): cover order-to-receipt flow
```

## Driver

```text
feat(driver): scaffold expo routes
feat(driver): add assigned trip list
feat(driver): add trip overview
feat(driver): add stop delivery flow
feat(driver): add pod capture ui
feat(driver): add sqlite persistence
feat(driver): add offline outbox
feat(driver): add reconnect synchronization
fix(driver): preserve unsynced events after restart
test(driver): cover offline delivery recovery
```

## Loader

```text
feat(loader): scaffold expo routes
feat(loader): add assigned trip list
feat(loader): add stop-sequenced loading view
feat(loader): add shortfall flow
feat(loader): add damaged item flow
feat(loader): persist load events offline
feat(loader): sync loader exceptions
feat(loader): mark trip ready
test(loader): cover loading exception flow
```

## Planning

```text
feat(planning): build vehicle compatibility matrix
feat(planning): enforce weight and volume capacities
feat(planning): enforce reefer and van-only constraints
feat(planning): enforce depot window and fuel constraints
feat(planning): add max two-trip rule
feat(planning): generate served and deferred assignments
feat(planning): add independent plan validator
feat(planning): add deferral reason generation
test(planning): cover overloaded delivery day
```
