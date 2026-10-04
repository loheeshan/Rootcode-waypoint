export type ReadyStopStatus = "upcoming" | "done";

export type ReadyStop = {
  id: string;
  stopNo: number;
  outlet: string;
  windowStart: string;
  windowEnd: string;
  status: ReadyStopStatus;
};

export type TripReadySnapshot = {
  vehicle: string;
  depot: string; // e.g. "Colombo Fresh"
  syncLabel: string;
  tripLabel: string; // e.g. "Trip 1 · Fresh"
  sector: string; // e.g. "Colombo"
  loadedBy: string; // e.g. "Bay L4"
  seal: string; // e.g. "SL-8842"
  departure: string; // e.g. "03:30"
  vehicleType: string; // e.g. "Reefer Truck"
  weightKg: number;
  volume: string; // e.g. "14.4 m³"
  stops: ReadyStop[];
};