# Dispatcher

Dispatcher web integration (Step 4). Pages live in `apps/web/app/dispatcher/*` (frontend team's UI);
this folder holds the shared pieces:

- `data/dispatcher.ts`: every API call (orders, fleet inputs with ETags, plans, optimization, results,
  publication, operations, audit), labels, exact decimal-string sums and the request-ID keeper used for
  retries. Relative imports only, so Vitest can load it (`apps/web/tests/dispatcher-data.test.ts`).
- `components/DispatcherShell.tsx`: session gate and sign-in (role DISPATCHER), depot/date context,
  sidebar and navbar. Route visibility is not authorization; the API checks role and depot on every request.
- `components/ui.tsx`: alerts, load/empty/error states, status badges, pager.

See `docs/testing/INTEGRATION-HANDOFF.md` (Step 4) for API gaps and verification.
