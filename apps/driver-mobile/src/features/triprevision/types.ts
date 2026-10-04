export type RevisionStopStatus = "delivered" | "partial" | "current" | "upcoming";

export type RevisionStop = {
  id: string;
  stopNo: number;
  outlet: string;
  windowStart: string;
  windowEnd: string;
  status: RevisionStopStatus;
  doneAt?: string; // local completion time, e.g. "04:18"
  outletCode?: string; // shown on the current stop
  address?: string;
  eta?: string;
};

export type TripRevisionSnapshot = {
  driverName: string;
  vehicle: string;
  syncLabel: string;
  revisionMessage: string | null; // null = no banner
  tripLabel: string;
  routeName: string;
  tripStatus: string;
  cargoKg: number;
  cargoVolume: string; // e.g. "14.4 m³"
  stops: RevisionStop[];
};