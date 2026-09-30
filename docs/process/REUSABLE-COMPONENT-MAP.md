# Reusable Component Map

## Build order

```text
design tokens
-> primitives
-> domain components
-> screen sections
-> role screens
```

## Shared design tokens

Location:
```text
packages/design-tokens/
```

Include:
```text
colors
typography
spacing
border radius
shadows
status colors
```

## Web primitives

Location:
```text
packages/web-ui/
```

Components:
```text
Button
Input
Select
SearchInput
Checkbox
Modal
Dropdown
Tabs
Badge
StatusPill
Card
Table
Pagination
Toast
Skeleton
EmptyState
ErrorState
```

## Web domain components

```text
OrderCard
TripCard
VehicleCard
OutletCard
MetricCard
ConstraintBadge
CapacityBar
DeliveryTimeline
DeferralReason
```

Used by:
- Dispatcher
- Store Manager

## Mobile primitives

Location:
```text
packages/mobile-ui/
```

Components:
```text
MobileButton
MobileInput
ScreenHeader
BottomAction
StatusPill
SectionCard
InfoRow
OfflineBanner
SyncStatus
LoadingState
ErrorState
```

## Mobile domain components

```text
TripCard
StopCard
OrderSummary
IssueCard
PODPreview
LoadItem
SyncQueueSummary
```

Used by:
- Driver
- Loader

## Reuse rule

Do not create role-specific duplicates if styling is identical.

Bad:
```text
DispatcherButton
StoreButton
DriverButton
LoaderButton
```

Good:
```tsx
<Button variant="primary" />
<StatusPill status="deferred" />
<StatusPill status="delivered" />
```
