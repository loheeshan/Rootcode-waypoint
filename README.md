# Rootcode — Waypoint application foundation

Monorepo boilerplate for the delivery operations application described in the supplied Rootcode Markdown pack. This is the **repository foundation**, not the completed hackathon MVP.

## Included

- Next.js App Router starter with `/dispatcher` and `/store` workspaces.
- Separate Driver and Loader Expo Router apps, SQLite schema initialization, SecureStore token adapters, and network state display.
- FastAPI application with liveness/readiness endpoints, PostgreSQL connection setup, Alembic configuration, and all nine backend module folders.
- Five shared TypeScript packages, a credential-storage-free API client, matching status types, starter UI components and provisional design tokens.
- pnpm and uv lockfiles, checks, GitHub Actions, Docker Compose, environment templates, and the original architecture/process documents.

The backend includes identity, fleet, order and planning models with migrations
`0001_user_roles`, `0002_fleet_foundation`, `0003_orders`, `0004_user_scopes` and
`0005_planning_foundation`.
They create users, roles, user-role assignments, depots, outlets, vehicles,
orders, user-outlet assignments, user-depot assignments, plans, plan revisions,
trips and trip stops, and seed the
four role definitions. JSON login (`POST /api/v1/auth/login`), current user
(`GET /api/v1/me`), Argon2id passwords, signed access tokens and reusable role
guards and outlet/depot scope helpers are implemented. Login and `/me` return
current role and resource assignments. See the [auth setup guide](apps/api/app/auth/README.md)
to configure the signing key and the [API contract](docs/architecture/API-CONTRACTS.md#auth)
for request/response fields. An explicit demo seed command creates the four role
accounts with a password you choose. A separate resource seed adds a synthetic
depot, two outlets, two vehicles and demo account assignments; sign-in screens
are not connected yet.
Store order creation, listing and detail endpoints enforce outlet access and the
16:00 Sri Lanka submission cutoff. See the [order API guide](apps/api/app/orders/README.md#store-order-api).
Dispatcher order listing and fleet reads now enforce depot assignments, with
filters, pagination and shared frontend response types. See the
[Dispatcher contract](docs/architecture/API-CONTRACTS.md#dispatcher).
Planning storage supports depot/day workspaces, revisions, vehicle/driver trip
references and ordered stops. Planning endpoints, order allocations and publishing
are still pending; see the [planning guide](apps/api/app/planning/README.md).
Remaining business endpoints and domain tables, optimization, competition dataset imports, POD capture, offline
outbox processing and end-to-end workflows are **not implemented**. Public starter
pages contain no real data. `scripts/seed.py --demo` delegates to the account seed;
`scripts/validate-plan.py` remains a placeholder.

## Structure

```text
Rootcode/
├── apps/
│   ├── web/                  # Dispatcher + Store Manager
│   ├── driver-mobile/        # Expo native app
│   ├── loader-mobile/        # Expo native app
│   └── api/                  # FastAPI modular backend
├── packages/
│   ├── design-tokens/
│   ├── web-ui/
│   ├── mobile-ui/
│   ├── api-contracts/
│   └── shared-types/
├── data/seed/
├── scripts/
├── docs/
├── Main/                     # Original supplied reference documents
├── .github/
└── docker-compose.yml
```

## Prerequisites

- Node.js 22 LTS (22.13 or newer) and **pnpm 10.34.6**.
- Python 3.12 and uv **0.9.21 or newer** for local API development.
- Docker Desktop running Linux containers for PostgreSQL/Compose.
- Android Studio/emulator or an Expo-compatible physical device for native testing. Local iOS native builds require macOS/Xcode.

Use the package manager version in `package.json`. With Corepack installed, `corepack pnpm` uses this version automatically. If plain `pnpm` resolves to a different version, use `corepack pnpm` for the commands below or install the pinned version with `npm install -g pnpm@10.34.6`. This repository does not change global Node/npm installations.

## Start locally (PowerShell)

```powershell
Set-Location D:\Rootcode
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
corepack pnpm install --frozen-lockfile
```

The setup script only creates missing `.env` files. Set the same local database password in root `.env` and `apps/api/.env`. If you change `POSTGRES_PORT`, update it in both files. If you change the web port, update `CORS_ORIGINS` to match. Environment files are ignored by Git.

Start PostgreSQL:

```powershell
docker compose up -d --wait postgres
```

Terminal 1 — API:

```powershell
Set-Location D:\Rootcode\apps\api
uv sync --frozen
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 — web:

```powershell
Set-Location D:\Rootcode
corepack pnpm dev:web
```

Open [web](http://localhost:3000), [API docs](http://localhost:8000/docs), [liveness](http://localhost:8000/health), and [database readiness](http://localhost:8000/ready). Liveness works without a database; readiness returns 503 when PostgreSQL cannot be reached. Migrations create the identity, fleet and order tables and four role definitions. No demo accounts, fleet records or orders are inserted.

Terminal 3 — Driver or Loader:

```powershell
Set-Location D:\Rootcode
corepack pnpm dev:driver
# In a separate terminal, if needed:
corepack pnpm dev:loader
```

Driver uses port 8081; Loader uses 8082. Set each app's `EXPO_PUBLIC_API_URL` before connecting API features. Android emulator: `http://10.0.2.2:8000/api/v1`. Physical phone: `http://YOUR_PC_LAN_IP:8000/api/v1`, with PC and phone on the same network. Restart Metro after changing environment values. The initial screen does not make an API request. Test native storage on a device; browser storage is not used.

## Run the container stack

After creating root `.env` and starting Docker Desktop:

```powershell
docker compose up --build
# In another terminal after the services are healthy:
docker compose exec api alembic upgrade head
docker compose exec api alembic current
docker compose exec api alembic check
```

This starts PostgreSQL, FastAPI and the web app. Mobile apps run separately. The Compose configuration is for local development; the web's API URL is compiled at build time. `docker compose down` preserves the named database volume. Migrations are explicit commands; the API does not create or alter tables at startup.

Current migration: `0005_planning_foundation (head)`. Apply migrations after
rebuilding the API. Users start with no outlet/depot assignments until
explicitly configured, including through the demo resource seed below.
For API-only startup and the
Windows host-port workaround, see [Backend step 2](docs/process/BACKEND-STEP-02.md).

## Demo login accounts

After rebuilding the API and applying migrations, run:

```powershell
docker compose exec api python -m app.auth.seed --demo
```

Enter and confirm your own password when prompted. This creates
`dispatcher@waypoint.demo`, `store@waypoint.demo`, `loader@waypoint.demo` and
`driver@waypoint.demo`; no password is stored in the repository. Re-runs preserve
existing accounts and permissions. The command permits only `APP_ENV=development`
or `test`. Configure `JWT_SECRET_KEY` before testing login in the API docs.
See [the demo setup guide](apps/api/app/auth/README.md#create-demo-accounts) for
local Python commands and verification.

To create the synthetic demo fleet and account assignments, run afterward:

```powershell
docker compose exec api python -m app.fleet.seed --demo
```

This adds one depot, two outlets, two vehicles and four account assignments.
It requires the four active demo accounts with their expected roles. Re-running
preserves matching data and restores missing demo assignments; conflicting rows
abort without overwriting them. Orders and trips are not seeded. See the
[resource setup guide](apps/api/app/fleet/README.md#synthetic-demo-data) for details.

## Checks

```powershell
corepack pnpm check
corepack pnpm export:mobile
Set-Location apps\api
uv run ruff check .
uv run mypy app
uv run pytest
```

`pnpm build` builds the web app. `pnpm export:mobile` bundles Android and iOS JavaScript for both apps; it does not produce APK/IPA binaries. Root tests cover the shared client, and API tests cover health, readiness, CORS, identity, fleet and order constraints, migration rollback/reapply, model/migration alignment, password/token validation, JSON login, current-user access, the four-role permission matrix, seed rollback and repeatable demo login. Add feature tests as each workflow is implemented.

## Next implementation branches

Follow [CONTRIBUTING.md](CONTRIBUTING.md) and [the commit plan](docs/process/COMMIT-PLAN.md): approved design tokens/components, API schemas, database models and migrations, authentication/role guards, then role workflows. Register new models in `apps/api/app/db/models.py` before running `uv run alembic revision --autogenerate -m "description"` and review the generated migration before `uv run alembic upgrade head`.

The backend increments and their commit/push commands are documented in
[Backend step 1: identity](docs/process/BACKEND-STEP-01.md) and
[Backend step 2: fleet](docs/process/BACKEND-STEP-02.md). The
[order module guide](apps/api/app/orders/README.md) covers the order migration.

The canonical architecture is in [docs/architecture](docs/architecture/SYSTEM-ARCHITECTURE.md). Original `Main/` documents are retained as references; detailed role screens there and in `docs/roles` describe future implementation, not completed functionality. Starter token values are not claimed to match Figma.

## GitHub setup

Follow [GITHUB-SETUP.md](docs/process/GITHUB-SETUP.md) for initial repository setup.
Develop on feature branches, review changes through pull requests into `dev`,
and promote reviewed releases to `main`. The fleet database increment uses
`feature/db-fleet-foundation`; its three commits are described in
[Backend step 2](docs/process/BACKEND-STEP-02.md).

## Dependency references

The native dependencies use the [Expo SDK 56 compatibility set](https://docs.expo.dev/versions/v56.0.0/) and the web uses the [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation). Exact resolved dependencies are recorded in the lockfiles.
