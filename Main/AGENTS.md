# AGENTS.md — Final

## 1. Development Guardian

Use before every push.

```text
Review current diff.

Check:
- correct role/platform
- Figma fidelity
- API integration
- auth/RBAC
- no secrets
- tests
- correct branch
- Conventional Commit
- no broken seed
- no broken Docker

For Driver/Loader:
- React Native/Expo
- SQLite persistence
- offline recovery
- idempotent sync

For planning:
- weight
- volume
- chilled/reefer
- van-only
- window
- depot
- fuel quota
- 2-trip max
- served/deferred

Return:
BLOCKERS
WARNINGS
TESTS TO RUN
RECOMMENDED COMMIT
SAFE TO PUSH: YES/NO
```

## 2. AI Budget Manager

```text
Use only relevant files.
Never send full repo by default.
Use architecture docs as context.
Ask one coding agent to implement.
Ask reviewer agent to inspect diff.
Do not generate duplicate implementations.
```

## 3. Integration Agent

Run on `dev` daily.

```text
Check complete workflow:
Store -> Dispatcher -> Loader -> Driver -> Store -> Dispatcher.

Find broken contracts between teams.
List exact failing endpoints/screens.
Do not redesign working features.
```

## 4. Deadline Agent

From Oct 3 onward:

```text
Reject new non-essential features.
Classify work:
BLOCKER
SUBMISSION REQUIRED
NICE TO HAVE

Only BLOCKER and SUBMISSION REQUIRED may be implemented.
```
