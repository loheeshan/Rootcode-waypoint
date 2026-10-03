# Backend step 2 — depots, outlets, and vehicles

Branch: `feature/db-fleet-foundation`

This increment adds fleet master data on top of the merged identity schema.
Migration `0002_fleet_foundation` follows `0001_user_roles` and creates `depots`,
`outlets`, and `vehicles`. It preserves existing users, role definitions, and
role assignments. Fleet tables start empty; there are no fleet endpoints yet.

## Files and behavior

| File | Purpose |
|---|---|
| `apps/api/app/fleet/models.py` | Depot, outlet, and vehicle models and allowed enum values |
| `apps/api/app/db/models.py` | Registers fleet models alongside identity models |
| `apps/api/migrations/versions/0002_fleet_foundation.py` | Creates the three tables, constraints, and depot-reference indexes |
| `apps/api/tests/test_fleet_schema.py` | Valid values, rejected inputs, depot deletion protection, and migration rollback/reapply |

See the [data model](../architecture/DATA-MODEL.md) for field types and limits.
`mall_window` means a yes/no mall restriction on the existing delivery times.
For example, deliveries allowed from 08:00 to 10:00 use those times with the flag
set to yes. It does not introduce separate mall opening and closing times.
Vehicle availability, fuel usage tracking, and planning enforcement remain
future work.

## Run with Docker

Start Docker Desktop in Linux-container mode. If root `.env` does not exist,
run the setup script and choose a local database password before starting:

```powershell
Set-Location D:\Rootcode
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

Keep existing `.env` values when they already work. If Windows blocks host port
`5432`, set `POSTGRES_PORT=15432` in root `.env`. The API container connects to
`postgres:5432`; the host-port change does not change that internal connection.
Environment files are ignored by Git.

Build the API image so it includes the new migration, then apply it:

```powershell
Set-Location D:\Rootcode
docker compose up -d --build --wait api
docker compose exec api alembic upgrade head
docker compose exec api alembic current
docker compose exec api alembic check
```

Expected revision: `0002_fleet_foundation (head)`. `alembic check` should report
no new upgrade operations. A fresh database has six application tables plus
`alembic_version`; only the four role definitions are inserted by migrations.
An existing database retains its identity records. Running `upgrade head`
again does not duplicate tables or seed records.

This command starts the API and PostgreSQL containers. The full Compose stack
also has a separate web container; Driver and Loader apps run outside Docker.
Migrations run only when explicitly requested, not when the API starts or when
`/health` and `/ready` are called.

## Local development checks

For a Windows-hosted API, use the same database password in root `.env` and
`apps/api/.env`, and set the API file's `POSTGRES_PORT` to the published host
port (for example, `15432`). If using `DATABASE_URL`, it must point to that same
database and port.

With PostgreSQL running, the local Python commands are:

```powershell
Set-Location D:\Rootcode\apps\api
uv sync --frozen
uv run alembic upgrade head
uv run alembic current
uv run alembic check
uv run ruff check .
uv run mypy app
uv run pytest -q
```

The API image excludes development dependencies and tests, so run `pytest`,
Ruff, and mypy from this local development environment.

The committed schema tests run the real migrations against disposable SQLite
databases and compile PostgreSQL DDL. They cover valid fleet data, delivery
windows, numeric bounds and nonfinite values, foreign keys, depot deletion
protection, and identity preservation through fleet rollback and reapply.
The identity suite also compares the migrated schema with all registered models.

Validation recorded for the migration commit: Ruff passed; mypy passed for
20 source files; all 66 backend tests passed. A separate temporary PostgreSQL 17
database passed 46 checks: the 45 fleet cases plus schema/default comparison.
That database was removed after verification; the application database was not
used for rollback tests. A separate source review found no blocking defect.

Downgrading from `0002_fleet_foundation` to `0001_user_roles` drops the fleet
tables and their data while keeping identity tables. Test rollback only in a
disposable database. Normal setup uses the upgrade commands above.

## Commit sequence

1. `feat(fleet): define depot outlet and vehicle models` — adds the fleet models.
2. `feat(db): add fleet migration and schema tests` — registers the models,
   updates their module description, and adds the migration and tests.
3. `docs(db): document fleet schema and migration setup` — documents the schema,
   verification steps, and current implementation status.

After the first two commits, stage only these documentation files for commit 3:

```powershell
Set-Location D:\Rootcode
git status
git diff
git add README.md apps/api/app/fleet/README.md docs/architecture/DATA-MODEL.md docs/process/BACKEND-STEP-01.md docs/process/BACKEND-STEP-02.md
git diff --cached
git commit -m "docs(db): document fleet schema and migration setup"
git push -u origin feature/db-fleet-foundation
```

After all three commits have been pushed, open a pull request from
`feature/db-fleet-foundation` into `dev`. Review CI and merge the fleet increment
before starting the next backend branch. See [GitHub setup](GITHUB-SETUP.md) for
the repository's pull request workflow.

The next planned database increment is order models and their migration, split
into reviewable commits following [COMMIT-PLAN.md](COMMIT-PLAN.md).
