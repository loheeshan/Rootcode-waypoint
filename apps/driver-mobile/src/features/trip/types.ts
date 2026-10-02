export type StopStatus = "delivered" | "partial" | "current" | "upcoming" | "failed";

export type TripStop = {
  id: string;
  stopNo: number;
  outlet: string;
  windowStart: string;
  windowEnd: string;
  status: StopStatus;
  doneAt?: string; // local completion time, e.g. "04:18"
};

export type TripSnapshot = {
  driverName: string;
  vehicle: string;
  syncLabel: string;
  routeRevision: string | null; // null = no banner
  tripLabel: string;
  routeName: string;
  tripStatus: string;
  cargoKg: number;
  cargoVolume: string; // e.g. "14.4m³"
  stops: TripStop[];
};