# Design Deviations

Record meaningful differences from the Designathon submission.

## Template

### Deviation ID
`DEV-001`

### Designathon behavior
...

### Implemented behavior
...

### Reason
...

### Impact
...

## DEV-001 — POD storage

Design expectation:
external object storage could be used.

Implemented:
POD images are compressed and stored in PostgreSQL `BYTEA`.

Reason:
zero object-storage budget and limited implementation time.

Impact:
no visible user-flow change.
