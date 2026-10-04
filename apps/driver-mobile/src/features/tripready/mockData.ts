import { TripReadySnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the downloaded trip read from SQLite
export const mockTripReady: TripReadySnapshot = {
  vehicle: "VEH018",
  depot: "Colombo Fresh",
  syncLabel: "Synced",
  tripLabel: "Trip 1 · Fresh",
  sector: "Colombo",
  loadedBy: "Bay L4",
  seal: "SL-8842",
  departure: "03:30",
  vehicleType: "Reefer Truck",
  weightKg: 1820,
  volume: "14.4 m³",
  stops: [
    { id: "s1", stopNo: 1, outlet: "Cargills Kollupitiya", windowStart: "04:00", windowEnd: "04:45", status: "upcoming" },
    { id: "s2", stopNo: 2, outlet: "Food City Bambalapitiya", windowStart: "04:50", windowEnd: "05:30", status: "upcoming" },
    { id: "s3", stopNo: 3, outlet: "Keells Havelock", windowStart: "05:35", windowEnd: "06:15", status: "upcoming" },
    { id: "s4", stopNo: 4, outlet: "OUT017 Waypoint Fresh", windowStart: "06:20", windowEnd: "07:00", status: "upcoming" },
    { id: "s5", stopNo: 5, outlet: "OUT021 Cargills Express Borella", windowStart: "07:15", windowEnd: "08:00", status: "upcoming" },
    { id: "s6", stopNo: 6, outlet: "OUT025 Keells Maradana", windowStart: "08:05", windowEnd: "08:25", status: "upcoming" },
    { id: "s7", stopNo: 7, outlet: "OUT029 Glomark Kotte", windowStart: "08:30", windowEnd: "09:15", status: "upcoming" },
  ],
};