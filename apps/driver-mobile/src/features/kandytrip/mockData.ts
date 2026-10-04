import { KandyTripSnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the revised trip read from SQLite
export const mockKandyTrip: KandyTripSnapshot = {
  vehicle: "VEH018",
  depot: "Kandy Fresh",
  syncLabel: "Synced",
  stops: [
    { id: "s4", stopNo: 4, outlet: "OUT088", status: "delivered", capturedAt: "06:24" },
    { id: "s5", stopNo: 5, outlet: "OUT091", status: "partial", partialLabel: "Partial 8/10", capturedAt: "06:41" },
    { id: "s6", stopNo: 6, outlet: "OUT093", status: "delivered", capturedAt: "06:58" },
    { id: "s7", stopNo: 7, outlet: "OUT095", status: "removed" },
  ],
};