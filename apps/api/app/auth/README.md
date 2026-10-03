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
future request guards must load that user's active state and roles from the
database. Roles are not trusted from token claims.

Before using token helpers, generate a signing key from `apps/api`:

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
`uv run pytest -q` from `apps/api`. No database migration is needed for these
helpers. They do not create accounts or expose login endpoints.

Email validation, login, `/me`, role guards, account/outlet/depot scope, demo
accounts, and refresh/revocation behavior remain future work.

Library references: [Argon2 password hashing](https://argon2-cffi.readthedocs.io/en/stable/howto.html)
and [PyJWT validation](https://pyjwt.readthedocs.io/en/stable/api.html).
