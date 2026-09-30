# Contributing Guide

## Permanent branches

```text
main
dev
```

`main` is release-only. `dev` is integration-only. No direct feature pushes to either.

## Branch names

```text
feature/<scope>-<feature>
fix/<scope>-<bug>
docs/<topic>
chore/<topic>
refactor/<scope>-<purpose>
test/<scope>-<purpose>
```

Examples:

```text
feature/dispatcher-plan-board
feature/store-order-status
feature/driver-offline-sync
feature/loader-shortfall
feature/api-orders
feature/planning-allocation
fix/driver-pod-sync
docs/judge-walkthrough
chore/repository-foundation
```

## Start work

```bash
git checkout dev
git pull origin dev
git checkout -b feature/driver-offline-sync
```

## Check work

```bash
git status
git diff
```

## Commit convention

```text
feat(scope): description
fix(scope): description
docs(scope): description
test(scope): description
refactor(scope): description
chore(scope): description
ci(scope): description
perf(scope): description
```

Good:

```text
feat(driver): add offline delivery queue
feat(dispatcher): add plan validation summary
fix(sync): prevent duplicate delivery events
test(planning): cover reefer compatibility
```

Bad:

```text
update
final
done
changes
fixed
```

## Before push

Web:
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Mobile:
```bash
pnpm lint
pnpm typecheck
pnpm test
npx expo export
```

Backend:
```bash
ruff check .
mypy app
pytest
```

Then run Development Guardian.

## Push

```bash
git push -u origin feature/driver-offline-sync
```

Open PR:

```text
feature/driver-offline-sync -> dev
```

## PR checklist

```md
## What changed
## User role / feature
## How to test
## Screenshots
## API changes
## Database changes

- [ ] Figma matched
- [ ] lint passes
- [ ] type-check passes
- [ ] tests pass
- [ ] no secrets committed
- [ ] role permissions checked
- [ ] responsive/mobile checked
- [ ] offline checked if applicable
- [ ] API contract updated if changed
- [ ] migration added if DB changed
```

## Sync latest dev

```bash
git checkout dev
git pull origin dev
git checkout feature/driver-offline-sync
git merge dev
```

Resolve conflicts, commit, push.

## Release flow

```text
feature/* -> dev -> integration test -> main
```

Tag final release:

```bash
git tag v1.0.0-hackathon-submission
git push origin v1.0.0-hackathon-submission
```
