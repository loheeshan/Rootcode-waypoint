import { TripCompleteSnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the finished trip read from SQLite
export const mockTripComplete: TripCompleteSnapshot = {
  vehicle: "VEH018",
  depot: "Colombo Fresh",
  syncLabel: "Synced",
  tripLabel: "Trip 1",
  activeStops: 6,
  removedStop: 6,
  departure: "03:30",
  finalCapture: "08:54",
};