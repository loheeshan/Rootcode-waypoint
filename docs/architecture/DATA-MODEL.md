# Data Model

## Core tables

```text
users
roles
user_roles

depots
outlets
vehicles
vehicle_availability
vehicle_fuel_usage

orders

plans
plan_revisions
trips
trip_stops
plan_assignments
deferral_decisions

load_events
delivery_events
proof_of_delivery
receipt_confirmations

sync_events
audit_events
```

## Key table fields

### users
```text
id
email
password_hash
is_active
created_at
```

### outlets
```text
id
brand
district
depot_id
dock_type
parking_constraint
window_open_time
window_close_time
mall_window
```

### vehicles
```text
id
type
temperature_type
weight_cap_kg
volume_cap_m3
km_per_l
weekly_fuel_quota_l
depot_id
```

### orders
```text
id
outlet_id
requested_delivery_date
temperature_requirement
order_weight_kg
order_volume_m3
status
created_at
```

### plans
```text
id
delivery_date
status
created_by
created_at
```

### plan_revisions
```text
id
plan_id
revision_number
status
published_at
```

### trips
```text
id
plan_revision_id
vehicle_id
trip_number
status
```

### trip_stops
```text
id
trip_id
outlet_id
sequence_number
planned_arrival_time
status
```

### deferral_decisions
```text
id
order_id
plan_revision_id
reason_code
reason_text
created_at
```

### proof_of_delivery
```text
id
delivery_event_id
receiver_name
photo_mime_type
photo_bytes BYTEA
photo_size_bytes
created_at
```

### sync_events
```text
id
event_id UNIQUE
device_id
user_id
entity_type
entity_id
event_type
received_at
```

## Invariants

- `sync_events.event_id` unique
- max 2 trips per vehicle/day
- chilled never assigned to ambient vehicle
- van-only outlet never assigned to truck
- published plan revision immutable
- delivery evidence append-only
