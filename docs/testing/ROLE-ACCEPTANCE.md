# Role acceptance checklist

Record each row as PASS, FAIL or NOT RUN with evidence (route/screen, environment, date).
Use the real FastAPI/PostgreSQL backend; mocked responses do not count. Never record passwords.

## Store Manager (web, `store@waypoint.demo`)

| Flow | Expected | Result |
|---|---|---|
| Login screen -> `/me` | STORE_MANAGER, Store outlet scope, lands on Store home | PASS (Step 2, production build, disposable DB) |
| Wrong password / wrong role / logout / expired session | Error shown, no navigation; protected routes redirect | PASS (Step 2) |
| Create order (before/after 16:00 Colombo) | Persisted; accepted date and cutoff message from the server | PASS after 16:00 (Step 3); server acceptance before 16:00 NOT RUN |
| List/detail after reload | Same order, server status | PASS (Step 3) |
| Delivered order -> confirm receipt (retry/double click) | One receipt; `RECEIPT_CONFIRMED` | PASS (Step 3) |
| Undelivered or failed-stop order | No receipt action | PASS (Step 3) |

## Dispatcher (web, `dispatcher@waypoint.demo`)

| Flow | Expected | Result |
|---|---|---|
| Login screen -> `/me` | DISPATCHER, depot from `/fleet`, lands on dashboard | PASS (Step 4, production build, disposable DB) |
| Wrong password / Store account / sign out + reload | Error shown, no navigation; sign-in after sign-out | PASS (Step 4) |
| Orders by depot/date/status, server pagination | Store-created orders with server values | PASS (Step 4; pagination beyond 20 orders NOT RUN) |
| Availability and fuel inputs (ETag / `If-Match` / `If-None-Match`) | 201 create, 200 replace, 412 shows current value; decimal strings | PASS (Step 4) |
| Create plan -> optimize (synthetic travel, labelled) | Saved revision; served trips, stop sequence, weight/volume; deferrals with server reasons | PASS (Step 4) |
| Assign demo Driver -> publish revision (double click) | One publication; reload shows the same effective revision; Loader sees trips | PASS (Step 4) |
| Stale publication / lost response retry | 409 reason shown and reload; retry reuses the request ID (200 replay) | PASS (Step 4) |
| Overlapping driver trips (422), fuel quota rejection | Server reason shown | NOT RUN |
| Live operations: loading progress and exceptions, audit log | Server counts, `MISSING` exception with note, audit entries | PASS (Step 4, Loader API events) |
| Live operations: delivered/failed stops, Store receipts | Server counts and exceptions | NOT RUN (needs a same-day `operations` fixture) |
| Wrong depot | 403 | PASS (API through the proxy; the UI lists only assigned depots) |

## Loader (mobile, `loader@waypoint.demo`)

| Flow | Expected | Result |
|---|---|---|
| Login on emulator/device -> `/me` | LOADER, depot scope | PASS (Step 5, emulator) |
| Published trips and stop-ordered manifest | Server trips/orders | PASS (Step 5) |
| LOADED / MISSING / DAMAGED with notes; retry | One event per action; latest outcome shown | PASS (double tap; device retry after network loss NOT RUN) |
| Ready (all orders recorded, at least one LOADED) | READY visible to the Driver API | PASS (Step 5; stale sequence refreshes) |
| Offline save -> kill/relaunch -> reconnect | Events apply exactly once | PASS (Step 7, emulator: airplane mode, relaunch, reconnect) |

## Driver (mobile, `driver@waypoint.demo`)

| Flow | Expected | Result |
|---|---|---|
| Login on emulator/device -> `/me` | DRIVER, depot scope, own trips only | PASS (Step 6, emulator; other driver 404) |
| Start blocked until READY; start READY trip | `IN_PROGRESS` | PASS (Step 6) |
| Arrive -> photo POD -> deliver | Store sees `DELIVERED` | PASS (Step 6; photo read back from the server) |
| Fail with reason/note | Stop FAILED; orders never DELIVERED | PASS (Step 6) |
| Complete trip | `COMPLETED` once every visited stop has an outcome | PASS (Step 6) |
| Offline POD/delivery -> relaunch -> reconnect | One upload and event result | NOT RUN |

## Cross-role (Step 9)

Store -> Dispatcher -> Loader -> Driver -> Store -> Dispatcher with the same IDs: NOT RUN.
