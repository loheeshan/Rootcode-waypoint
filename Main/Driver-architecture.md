# Driver Architecture — Final Native Mobile

**Frontend owners:** Vashika, Lisha  
**Support:** Sivananthi  
**Backend:** Loheeshan, Krish, Lisha

## Stack

```text
React Native
Expo
TypeScript
Expo Router
Expo SQLite
Expo SecureStore
NetInfo
```

## Must-have screens

```text
1. Login
2. Today's Trips
3. Trip Overview
4. Current Stop
5. Delivery Outcome
6. POD
7. Offline / Sync Status
```

## Local data

```text
trips
stops
outbox
sync_state
```

## Offline rule

Every delivery action:

```text
save SQLite
 -> update UI
 -> queue outbox
 -> sync later
```

Do not wait for backend before continuing.

## POD

To avoid S3 cost:

1. resize/compress photo on device;
2. upload to API;
3. API stores bytes in PostgreSQL;
4. max size around 500 KB–1 MB.

## Branch ownership

### Vashika
```text
feature/driver-trip-list
feature/driver-stop-flow
feature/driver-pod-ui
```

### Lisha
```text
feature/driver-sqlite
feature/driver-sync
feature/driver-api-integration
```

## Commits

```text
feat(driver): add trip screens
feat(driver): persist stops in sqlite
feat(driver): queue offline delivery events
feat(driver): add pod capture
feat(driver): synchronize pending events
```

## Definition of done

Airplane-mode test:

```text
open trip
disable internet
complete stop
capture POD
refresh/reopen app
data still exists
enable internet
event syncs
Store Manager sees delivered
```
