# Backend step 1 — users and roles

Branch: `feature/db-users-roles`

This guide records the identity increment. Later migrations are also included;
see the [root README](../../README.md) for the current revision and setup.

This increment adds three identity tables and the four role definitions. It does
not add login or create user accounts. It is organized into four commits so each
change can be reviewed and pushed separately.

## Files

- `apps/api/app/auth/models.py`: SQLAlchemy identity models and role codes.
- `apps/api/app/db/base.py`: consistent migration constraint names.
- `apps/api/app/db/models.py`: central model registration.
- `apps/api/migrations/env.py`: loads all models and supports test connections.
- `apps/api/migrations/versions/0001_user_roles.py`: first reversible migration.
- `apps/api/tests/test_identity_schema.py`: schema, migration, and constraint tests.
- Updated auth README, root README, and data model documentation.

## Run and verify

Start Docker Desktop in Linux-container mode. If environment files do not exist,
create them with the existing setup script and set the same PostgreSQL password
in root `.env` and `apps/api/.env`.

If Windows blocks the default host port `5432`, set `POSTGRES_PORT=15432` in the
root `.env` file. Containers continue communicating with PostgreSQL on internal
port `5432`. When running the API directly on Windows, also set
`POSTGRES_PORT=15432` in `apps/api/.env` so it uses the published host port.
These `.env` files are local configuration and are ignored by Git.

```powershell
Set-Location D:\Rootcode
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
docker compose up -d --wait postgres
Set-Location apps\api
uv sync --frozen
uv run alembic upgrade head
uv run alembic current
uv run alembic check
uv run ruff check .
uv run mypy app
uv run pytest -q
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

At the identity-only revision, the expected migration was `0001_user_roles (head)`.
In newer checkouts, `upgrade head` also applies later migrations; see the
[root README](../../README.md) for the expected head. `alembic check` should report no
new upgrade operations. The first migration creates three tables and four role
rows, plus Alembic's version table. It inserts no user records. Database migrations are
explicit commands and are not executed by `/health` or `/ready`.

If you run the API through Docker instead of a local Python environment:

```powershell
Set-Location D:\Rootcode
docker compose up -d --build --wait api
docker compose exec api alembic upgrade head
docker compose exec api alembic current
docker compose exec api alembic check
```

The schema tests execute upgrade, downgrade, and reapply against disposable
in-memory SQLite databases, plus compile PostgreSQL-specific DDL. Do not run
`alembic downgrade base` against a database with user data: it removes these
tables. The live PostgreSQL migration commands above remain the integration check
when Docker is available.

Validation performed for this increment: Ruff passed; mypy passed for 19 source
files; all 21 backend tests passed (16 identity/schema cases and 5 existing health
tests); PostgreSQL offline migration SQL generated successfully; Git whitespace
check passed. Live PostgreSQL execution was not verified during that initial
automated check; use the migration commands above to verify your running
database. A separate source review found no blocking defect.

## Commit sequence

1. `chore(db): add consistent constraint naming` — `app/db/base.py`.
2. `feat(auth): define user and role models` — `app/auth/models.py` and
   `app/db/models.py`.
3. `feat(db): add identity migration and schema tests` — `migrations/env.py`,
   `migrations/versions/0001_user_roles.py`, and `tests/test_identity_schema.py`.
4. `docs(db): document identity schema and migration setup` — the four
   documentation files listed in the command below.

Paths in commits 1–3 are relative to `apps/api`. Review each staged diff before
committing. After commits 1–3, include only the documentation in commit 4:

```powershell
Set-Location D:\Rootcode
git status
git diff
git add README.md apps/api/app/auth/README.md docs/architecture/DATA-MODEL.md docs/process/BACKEND-STEP-01.md
git diff --cached
git commit -m "docs(db): document identity schema and migration setup"
git push -u origin feature/db-users-roles
```

After all four commits have been pushed, open a pull request from
`feature/db-users-roles` to `dev`. This branch builds on the merged repository
foundation. Review CI and merge this increment into `dev` before starting the
next backend branch. See [GITHUB-SETUP.md](GITHUB-SETUP.md) for the repository's
pull request workflow.

The next increment, depot, outlet, and vehicle tables, is documented in
[Backend step 2](BACKEND-STEP-02.md), following the database commit order in
[COMMIT-PLAN.md](COMMIT-PLAN.md).
