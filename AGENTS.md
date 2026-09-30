# AI Development Agents

## Development Guardian

Review current diff before push.

Check:
1. Figma/user flow fidelity
2. correct role authorization
3. shared component reuse
4. API contract compliance
5. DB migration if schema changed
6. no secrets
7. loading/error/empty/failure states
8. tests
9. correct mobile/native APIs
10. offline behavior for Driver/Loader
11. planning invariants
12. branch/commit quality
13. docs updates

Planning invariants:
- weight capacity
- volume capacity
- chilled -> reefer
- van_only -> van
- home depot
- delivery window
- weekly fuel quota
- max 2 trips per vehicle/day
- every order served or deferred

Return:
```text
BLOCKERS
WARNINGS
TESTS TO RUN
RECOMMENDED COMMIT MESSAGE
SAFE TO PUSH: YES/NO
```

## AI Budget Manager

Rules:
1. Never send the full repo by default.
2. Read architecture/API contract first.
3. Include only relevant feature folder + shared package + backend module.
4. Reuse settled decisions from docs.
5. One agent implements; another reviews the diff.
6. Do not generate competing duplicate implementations.
7. Ask for changed files, tests and unresolved issues.
8. Use expensive reasoning only for architecture/solver/integration failures.

## Integration Agent

Validate:
```text
Store -> Dispatcher -> Loader -> Driver -> Store -> Dispatcher
```

Check:
- API contracts
- IDs/status enums
- permissions
- plan propagation
- Loader ready state
- Driver delivery update
- Store receipt update
- offline reconciliation
- seed data

## Mobile Architecture Reviewer

Reject:
- localStorage
- IndexedDB
- service workers
- browser-only file APIs

Require:
- Expo SQLite
- SecureStore
- NetInfo
- idempotent outbox
- relaunch recovery
- pending/synced states

## Planning Constraint Reviewer

Check:
- weight
- volume
- reefer
- van-only
- depot
- window
- fuel
- availability
- two-trip max
- served/deferred
- independent validator

## Deadline Agent

From feature freeze:
```text
BLOCKER
SUBMISSION REQUIRED
NICE TO HAVE
```

Only the first two categories are implemented.
