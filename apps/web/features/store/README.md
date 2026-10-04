# Store Manager

Store Manager web feature (`/store`). Every screen reads and writes the scoped Store API through
the same-origin session proxy (`/api/backend`, see `apps/web/lib/auth-client.ts`); there is no
runtime mock data.

- `data/store.ts`: API calls (orders list/detail/create, receipt read/confirm) and view helpers.
- `components/`: screens. `useLoad` in `ui.tsx` gives each view loading, error, forbidden and
  session-expired handling.

Orders are whole consignments (temperature, weight, volume); there are no product lines.
Receipt confirmation reuses one request ID per order, so retries cannot create duplicates.
Fields the Store API does not expose yet (deferral reason, revised date, ETA, outlet names,
notifications, receipt discrepancies) are shown as unavailable rather than invented.
