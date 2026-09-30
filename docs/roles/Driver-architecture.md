# Driver Architecture

Owners:
- Vashika
- Lisha

Support:
- Sivananthi

Backend:
- Loheeshan
- Krish
- Lisha

Stack:
```text
React Native
Expo
TypeScript
Expo Router
Expo SQLite
Expo SecureStore
NetInfo
```

Flow:
```text
Login
-> Today's Trips
-> Trip Overview
-> Current Stop
-> Delivery Outcome
-> POD
-> Local Save
-> Sync
```

Branches:
```text
feature/driver-auth
feature/driver-trip-list
feature/driver-trip-overview
feature/driver-stop-flow
feature/driver-pod-ui
feature/driver-sqlite
feature/driver-outbox
feature/driver-sync
feature/driver-api-integration
```

Commits:
```text
feat(driver): add driver authentication
feat(driver): add assigned trip list
feat(driver): add trip overview
feat(driver): add stop delivery flow
feat(driver): add pod capture ui
feat(driver): add sqlite persistence
feat(driver): add offline event outbox
feat(driver): synchronize pending events
fix(driver): recover pending events after app restart
test(driver): cover offline delivery flow
```

Offline rule:
```text
save SQLite
-> update UI
-> queue event
-> sync later
```

Definition of Done:
- offline completion survives restart
- POD survives
- reconnect sync works
- Store sees delivered
