# Loader Architecture — Final Native Mobile

**Frontend owners:** Sivananthi, Lisha  
**Support:** Vashika  
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
2. Assigned Trips
3. Loading List
4. Stop Sequence
5. Missing/Damaged Item
6. Load Complete
```

## Flow

```text
published plan
 -> Loader trip
 -> mark loaded
 -> missing/damaged if needed
 -> sync exception
 -> Dispatcher receives exception
 -> mark ready
 -> Driver receives trip
```

## Offline

Loading checks can save locally.

Critical exception UI:

```text
Saved on device
Dispatcher has not received this yet
```

## Branch ownership

### Sivananthi
```text
feature/loader-trip-list
feature/loader-loading
feature/loader-shortfall-ui
```

### Lisha
```text
feature/loader-sqlite
feature/loader-sync
feature/loader-api-integration
```

## Definition of done

- published trip appears;
- loading works;
- missing/damaged works;
- Dispatcher receives exception;
- Loader can mark ready;
- Driver receives ready trip.
