export type KandyStopStatus = "delivered" | "partial" | "removed";

export type KandyStop = {
  id: string;
  stopNo: number;
  outlet: string; // e.g. "OUT088"
  status: KandyStopStatus;
  partialLabel?: string; // e.g. "Partial 8/10"
  capturedAt?: string; // phone capture time, e.g. "06:24"
};

export type KandyTripSnapshot = {
  vehicle: string;
  depot: string; // e.g. "Kandy Fresh"
  syncLabel: string;
  stops: KandyStop[];
};