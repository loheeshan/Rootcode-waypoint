export type RecordStatus = "delivered" | "partial" | "failed" | "removed";

export type TripRecord = {
  id: string;
  stopNo: number;
  outlet: string;
  status: RecordStatus;
  capturedAt?: string; // phone time, e.g. "04:18"
  reason?: string; // shown for failed deliveries, e.g. "access blocked"
};

export type TripRecordsSnapshot = {
  vehicle: string;
  depot: string; // e.g. "Colombo Fresh"
  syncLabel: string;
  records: TripRecord[];
};