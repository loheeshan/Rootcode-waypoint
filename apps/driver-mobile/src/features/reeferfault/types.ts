import { TripData } from "../today/types";

export type HeldTripData = {
  id: string;
  label: string; // e.g. "Trip 1 · Fresh"
  statusLabel: string; // e.g. "Loading Held"
  sector: string;
  departureLabel: string;
  departure: string;
  stops: number;
  weightKg: number;
  volume: string; // e.g. "14.4"
  loadedBy: string;
  seal: string;
};

export type ReeferFaultSnapshot = {
  greeting: string;
  syncLabel: string;
  vehicle: string;
  vehicleType: string;
  tempC: string;
  tempStatus: string; // e.g. "CRITICAL / UNLOCKED"
  alertChip: string;
  alertMessage: string;
  dateLabel: string;
  outletsTotal: number;
  heldTrip: HeldTripData;
  waitingTrip: TripData;
};