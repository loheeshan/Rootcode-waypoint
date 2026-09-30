# CONTRIBUTING.md — Team Git Rules

## Never push directly to main/dev

Work from latest dev:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/<scope>-<name>
```

## Before commit

```bash
git status
git diff
```

## Commit

```bash
git add <relevant-files>
git commit -m "feat(scope): clear description"
```

## Before push

Run relevant tests and Development Guardian.

Then:

```bash
git push -u origin <branch>
```

Open PR:

```text
feature/* -> dev
```

## Release

Only team lead merges:

```text
dev -> main
```

after:
- integration test;
- Docker fresh start;
- seeded accounts;
- judge walkthrough;
- deployment verified.

## Commit examples

```text
feat(dispatcher): add deferral review
feat(store): add receipt confirmation
feat(driver): add offline event queue
feat(loader): add shortfall reporting
feat(api): add receipt endpoint
feat(planning): enforce vehicle volume limit
fix(sync): prevent duplicate delivery event
```
