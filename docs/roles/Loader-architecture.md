# Loader Architecture

Owners:
- Sivananthi
- Lisha

Support:
- Vashika

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
Assigned Trips
-> Loading List
-> Stop Sequence
-> Loaded / Missing / Damaged
-> Dispatcher update
-> Load Complete
-> Trip Ready
```

Branches:
```text
feature/loader-auth
feature/loader-trip-list
feature/loader-loading
feature/loader-shortfall
feature/loader-damage
feature/loader-sqlite
feature/loader-sync
feature/loader-api-integration
feature/loader-ready
```

Commits:
```text
feat(loader): add loader authentication
feat(loader): add assigned trip list
feat(loader): add stop-sequenced loading view
feat(loader): add shortfall flow
feat(loader): add damage flow
feat(loader): persist load events locally
feat(loader): sync loader events
feat(loader): mark trip ready
test(loader): cover loading exception flow
```

Definition of Done:
- plan appears
- loading works
- exceptions work
- Dispatcher receives exception
- ready state reaches Driver
