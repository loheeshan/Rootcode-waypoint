import { FailureStopSnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the current stop read from SQLite
export const mockFailure: FailureStopSnapshot = {
  vehicle: "VEH018",
  syncLabel: "Synced",
  stopNo: 4,
  outletCode: "OUT017",
  tag: "Cold Fresh",
  outletName: "Waypoint Fresh",
  location: "Main Distribution Dock",
  evidence: { caption: "Rear gate locked", meta: "Captured 06:34 · Saved on phone" },
};