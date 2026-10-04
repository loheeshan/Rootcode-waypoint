export const roles = ['DISPATCHER', 'STORE_MANAGER', 'DRIVER', 'LOADER'] as const;
export type Role = (typeof roles)[number];
export const orderStatuses = ['CONFIRMED', 'PLANNED', 'DEFERRED', 'LOADING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIPT_CONFIRMED'] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const tripStatuses = ['PLANNED', 'LOADING', 'READY', 'IN_PROGRESS', 'COMPLETED'] as const;
export type TripStatus = (typeof tripStatuses)[number];
export const planStatuses = ['DRAFT', 'PUBLISHED'] as const;
export type PlanStatus = (typeof planStatuses)[number];
export const stopStatuses = ['PLANNED', 'ARRIVED', 'DELIVERED', 'FAILED'] as const;
export type StopStatus = (typeof stopStatuses)[number];
export const assignmentOutcomes = ['SERVED', 'DEFERRED'] as const;
export type AssignmentOutcome = (typeof assignmentOutcomes)[number];
export const deferralReasons = [
  'NO_COMPATIBLE_VEHICLE', 'REEFER_CAPACITY_EXHAUSTED', 'VAN_CAPACITY_EXHAUSTED',
  'WEIGHT_CAPACITY', 'VOLUME_CAPACITY', 'TIME_WINDOW', 'FUEL_QUOTA',
  'VEHICLE_UNAVAILABLE', 'TRIP_LIMIT',
] as const;
export type DeferralReason = (typeof deferralReasons)[number];
export const loadStatuses = ['LOADED', 'MISSING', 'DAMAGED'] as const;
export type LoadStatus = (typeof loadStatuses)[number];
export const syncStatuses = ['PENDING', 'SYNCING', 'SYNCED', 'FAILED'] as const;
export type SyncStatus = (typeof syncStatuses)[number];
