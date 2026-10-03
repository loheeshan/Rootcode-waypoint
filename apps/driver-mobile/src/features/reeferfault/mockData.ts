import { ReeferFaultSnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with today's trips and the live reefer sensor reading
export const mockReeferFault: ReeferFaultSnapshot = {
  greeting: "Good morning, Kasun",
  syncLabel: "Synced",
  vehicle: "VEH018",
  vehicleType: "Reefer Truck",
  tempC: "+4.0°C",
  tempStatus: "CRITICAL / UNLOCKED",
  alertChip: "ACTION REQUIRED · CHILLED HOLD ACTIVE",
  alertMessage: "Reefer fault detected — chilled cargo cannot be loaded until resolved.",
  dateLabel: "Wed, 18 Oct",
  outletsTotal: 12,
  heldTrip: {
    id: "t1",
    label: "Trip 1 · Fresh",
    statusLabel: "Loading Held",
    sector: "Colombo Metro",
    departureLabel: "DEPARTURE",
    departure: "03:30",
    stops: 7,
    weightKg: 1820,
    volume: "14.4",
    loadedBy: "Bay L4 (Rohan P.)",
    seal: "#SL-8842",
  },
  waitingTrip: {
    id: "t2",
    label: "Trip 2 · Fresh",
    status: "waiting",
    sector: "Gampaha North",
    departureLabel: "SCHEDULED DEPARTURE",
    departure: "05:40",
    stops: 5,
    weightKg: 1240,
    volume: "9.8",
  },
};