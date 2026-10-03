# auth

`models.py` provides `User`, `Role`, `UserRole`, and the four `RoleCode` values.
Migration `0001_user_roles` creates the tables and inserts the role definitions.
It creates no users or credentials.

Emails must be trimmed and lowercase before persistence. Database constraints
reject non-normalized/duplicate emails, empty password hashes, unknown role
codes, duplicate assignments, and orphan assignments.

`security.py` adds Argon2id password hashing and verification, plus HS256 access
token creation and validation using PyJWT. Passwords are preserved exactly;
empty inputs, invalid UTF-8, and inputs above 1024 UTF-8 bytes are rejected.
This is a processing limit, not the final account password policy.

Tokens expire after 30 minutes by default and require a UUID subject and token
ID, issue/not-before/expiry times, issuer, audience, and `token_type=access`.
The accepted algorithm is fixed in code. Token verification returns a user ID;
request guards load that user's active state and roles from the database on
every request. Roles are not trusted from token claims. Disabling/deleting a
user or removing their role takes effect on their next authenticated request.

Before using login, generate a signing key from `apps/api`:

```powershell
uv run python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Put the generated value in `JWT_SECRET_KEY` in root `.env` for Docker, and in
`apps/api/.env` for local API runs. Use the same key when both run against the
same environment. Keep it private; actual `.env` files remain ignored by Git.
The example files deliberately contain no working signing key. Missing, blank,
or shorter-than-32-byte keys prevent token operations. Health checks and
migrations can still run without a signing key.

Optional settings: `JWT_ISSUER=waypoint-api`, `JWT_AUDIENCE=waypoint-clients`,
and `ACCESS_TOKEN_EXPIRE_MINUTES=30` (allowed range 1–1440). Changing the key,
issuer, or audience invalidates previously issued tokens. Docker Compose passes
these values into the API container.

Run `uv sync --frozen`, `uv run ruff check .`, `uv run mypy app`, and
`uv run pytest -q` from `apps/api`. Apply the existing migrations with
`uv run alembic upgrade head` before logging in; this increment adds no migration.

## HTTP authentication

- `POST /api/v1/auth/login` accepts JSON `email` and `password`. Email is trimmed,
  lowercased and validated; passwords are preserved exactly. Extra fields are
  rejected. An active account with a matching password receives a bearer token,
  lifetime in seconds, and safe user fields.
- `GET /api/v1/me` requires `Authorization: Bearer <access_token>` and returns
  `id`, `email`, `is_active`, and current `roles`. Password hashes are never returned.
- Invalid credentials, inactive accounts and unknown accounts share a generic
  401 response. Invalid/missing/expired tokens also return 401. Invalid JSON input
  returns 422 without echoing raw input. Signing-key and database errors return 503.
- Successful login and `/me` responses use `Cache-Control: no-store`.

See the [JSON contract](../../../../docs/architecture/API-CONTRACTS.md#auth)
and OpenAPI at `/docs`. Use JSON login to obtain a token, then paste the token
into the Swagger **Authorize** bearer field.

For authenticated routes, use `Depends(get_current_user)`. For role access use
`Depends(require_roles(RoleCode.DISPATCHER))`, or pass several roles to allow
any of them. A valid user without an allowed role receives 403. These guards
do not enforce outlet/depot ownership; each domain endpoint must add its scope
checks before exposing business data.

Frontend sign-in screens are not connected yet. Account/outlet/depot scope,
password recovery, refresh tokens, per-token revocation and login rate limiting
remain future work. Until refresh is implemented, expired tokens require another
login. Client logout must discard its stored token.

## Create demo accounts

Seeding is an explicit command; migrations and API startup never create accounts.
It requires `APP_ENV=development` or `test` and a `--demo` flag. Compose forwards
`APP_ENV` from root `.env` (default `development`); local runs use `apps/api/.env`.
Run this only against your development/test database.

From `D:\Rootcode`, rebuild the API, apply migrations, then seed:

```powershell
docker compose up -d --build --wait api
docker compose exec api alembic upgrade head
docker compose exec api python -m app.auth.seed --demo
```

The command securely prompts twice for one password for the new accounts. Choose
a nonblank password of 12–1024 UTF-8 bytes; it is preserved exactly, including
spaces. Each account stores a separately salted Argon2id hash. Passwords and hashes
are never printed, accepted as command-line arguments, or committed. Use an
interactive terminal; the command refuses a prompt that would echo the password.

| Email | Role |
|---|---|
| `dispatcher@waypoint.demo` | `DISPATCHER` |
| `store@waypoint.demo` | `STORE_MANAGER` |
| `loader@waypoint.demo` | `LOADER` |
| `driver@waypoint.demo` | `DRIVER` |

For a locally running API, first ensure `apps/api/.env` points to the correct
database (including port `15432` if you used the Windows port workaround):

```powershell
cd D:\Rootcode\apps\api
uv sync --frozen
uv run alembic upgrade head
uv run python -m app.auth.seed --demo
```

The repository entry point also works from `D:\Rootcode`:
`uv run --project apps/api python scripts/seed.py --demo`. It uses `apps/api/.env`.
Choose either the Docker or local command for the same database.

All new users and assignments are committed in one transaction. Missing role
definitions or an insert failure leaves no partial seed. Re-running preserves
existing account IDs, passwords, active state and roles; it does not reactivate
users, grant missing roles, or reset passwords. The summary lists which accounts
were created and which were preserved. An existing account still needs its old
password, and its current roles may differ from the table above.

With `JWT_SECRET_KEY` configured as described above, open `/docs`, call JSON login
with a seeded email and the password you chose, paste the returned token into
**Authorize**, then call `GET /api/v1/me`. No default password exists. Fleet/order
dataset imports and outlet/depot assignments are separate future increments.

Library references: [Argon2 password hashing](https://argon2-cffi.readthedocs.io/en/stable/howto.html)
and [PyJWT validation](https://pyjwt.readthedocs.io/en/stable/api.html).
