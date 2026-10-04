export type TripStatus = "loaded" | "waiting";

export type TripData = {
  id: string;
  label: string; // e.g. "Trip 1 · Fresh"
  status: TripStatus;
  sector: string;
  departureLabel: string; // "DEPARTURE" | "SCHEDULED DEPARTURE"
  departure: string;
  stops: number;
  weightKg: number;
  volume: string; // e.g. "14.4"
  loadedBy?: string;
  seal?: string;
};

export type TodaySnapshot = {
  driverName: string;
  greeting: string;
  syncLabel: string;
  vehicle: string;
  vehicleType: string;
  tempC: string;
  tempLocked: boolean;
  dateLabel: string;
  trips: TripData[];
  outletsTotal: number;
};