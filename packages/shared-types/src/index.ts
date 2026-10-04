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
export const deliveryEventTypes = [
  'TRIP_STARTED', 'ARRIVED', 'DELIVERED', 'FAILED', 'TRIP_COMPLETED',
] as const;
export type DeliveryEventType = (typeof deliveryEventTypes)[number];
export const deliveryFailureReasons = [
  'OUTLET_CLOSED', 'RECEIVER_UNAVAILABLE', 'ACCESS_BLOCKED', 'DELIVERY_REFUSED',
  'VEHICLE_ISSUE', 'OTHER',
] as const;
export type DeliveryFailureReason = (typeof deliveryFailureReasons)[number];
export const syncEventTypes = [
  'LOAD_RECORDED', 'TRIP_READY', 'TRIP_STARTED', 'STOP_ARRIVED', 'STOP_DELIVERED',
  'STOP_FAILED', 'TRIP_COMPLETED',
] as const;
export type SyncEventType = (typeof syncEventTypes)[number];
export const syncOutcomes = ['APPLIED', 'DUPLICATE', 'REJECTED', 'CONFLICT', 'RETRY', 'SKIPPED'] as const;
export type SyncOutcome = (typeof syncOutcomes)[number];
export const auditActions = [
  'PLAN_PUBLISHED', 'LOAD_RECORDED', 'TRIP_READY', 'TRIP_STARTED', 'STOP_ARRIVED',
  'POD_UPLOADED', 'STOP_DELIVERED', 'STOP_FAILED', 'TRIP_COMPLETED', 'RECEIPT_CONFIRMED',
  'SYNC_CONFLICT',
] as const;
export type AuditAction = (typeof auditActions)[number];
export const auditEntities = ['PLAN', 'TRIP', 'STOP', 'ORDER'] as const;
export type AuditEntity = (typeof auditEntities)[number];
export const operationsExceptionKinds = [
  'LOAD_MISSING', 'LOAD_DAMAGED', 'DELIVERY_FAILED', 'RECEIPT_PENDING', 'SYNC_CONFLICT',
] as const;
export type OperationsExceptionKind = (typeof operationsExceptionKinds)[number];
export const syncStatuses = ['PENDING', 'SYNCING', 'SYNCED', 'FAILED'] as const;
export type SyncStatus = (typeof syncStatuses)[number];
