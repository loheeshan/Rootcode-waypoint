# auth

`models.py` provides `User`, `Role`, `UserRole`, and the four `RoleCode` values.
Migration `0001_user_roles` creates the tables and inserts the role definitions.
It creates no users or credentials.

Emails must be trimmed and lowercase before persistence. Database constraints
reject non-normalized/duplicate emails, empty password hashes, unknown role
codes, duplicate assignments, and orphan assignments. Password hashing, email
format validation, login, JWT handling, role guards, and outlet/depot access
scope are future increments. Storing a password hash alone is not authentication.
