import { OfflineFailureSnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the current stop read from SQLite
export const mockOfflineFailure: OfflineFailureSnapshot = {
  vehicle: "VEH018",
  bannerText: "No connection · Working offline",
  queuedLabel: "QUEUED",
  offlineLabel: "Offline",
  stopNo: 4,
  outletCode: "OUT017",
  tag: "Cold Fresh",
  outletName: "Waypoint Fresh",
  location: "Main Distribution Dock",
  evidence: {
    fileName: "Bay_Gate_Locked.jpg",
    meta: "08:14 AM • GPS: 6.9271, 79.8612",
  },
};