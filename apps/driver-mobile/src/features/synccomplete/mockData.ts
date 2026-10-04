import { SyncCompleteSnapshot } from "./types";

// TODO(feature/driver-sync): replace with the records the outbox just sent
export const mockSyncComplete: SyncCompleteSnapshot = {
  vehicle: "VEH018",
  depot: "Kandy Fresh",
  syncLabel: "Synced",
  sentAt: "07:04",
  routeUpdate: {
    title: "Route update received",
    body: "Stop 7 removed from this trip. Check the revised stop sequence before moving.",
  },
  records: [
    { id: "r1", stopNo: 4, outlet: "OUT088", outcome: "delivered", capturedAt: "06:24", sentAt: "07:04" },
    { id: "r2", stopNo: 5, outlet: "OUT091", outcome: "partial", partialLabel: "Partial 8/10", capturedAt: "06:41", sentAt: "07:04" },
    { id: "r3", stopNo: 6, outlet: "OUT093", outcome: "delivered", capturedAt: "06:58", sentAt: "07:04" },
  ],
};