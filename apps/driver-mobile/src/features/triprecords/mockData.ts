import { TripRecordsSnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the saved delivery records read from SQLite
export const mockTripRecords: TripRecordsSnapshot = {
  vehicle: "VEH018",
  depot: "Colombo Fresh",
  syncLabel: "Synced",
  records: [
    { id: "r1", stopNo: 1, outlet: "Cargills Kollupitiya", status: "delivered", capturedAt: "04:18" },
    { id: "r2", stopNo: 2, outlet: "Bambalapitiya", status: "delivered", capturedAt: "05:05" },
    { id: "r3", stopNo: 3, outlet: "Havelock", status: "partial", capturedAt: "05:52" },
    { id: "r4", stopNo: 4, outlet: "OUT017", status: "delivered", capturedAt: "06:34" },
    { id: "r5", stopNo: 5, outlet: "Borella", status: "failed", reason: "access blocked", capturedAt: "07:32" },
    { id: "r6", stopNo: 6, outlet: "Rajagiriya", status: "removed" },
    { id: "r7", stopNo: 7, outlet: "Kotte", status: "delivered", capturedAt: "08:54" },
  ],
};