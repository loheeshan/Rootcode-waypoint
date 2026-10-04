import { NextStopClosedSnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the current stop and the live access rules
export const mockNextStopClosed: NextStopClosedSnapshot = {
  initials: "KW",
  tripRef: "#TRP-8420",
  syncLabel: "Synced",
  stopNo: 4,
  stopTotal: 7,
  outletCode: "OUT017",
  outletName: "OUT017 Waypoint Fresh",
  address: "Central Plaza, Level B2 North Bay",
  windowStart: "09:00",
  windowEnd: "12:00",
  eta: "08:15",
  completedStops: 3,
  access: {
    dock: "REAR_DOCK",
    currentTime: "08:15",
    waitMinutes: 45,
    opensAt: "09:00",
    waitNote: "Time limit strictly enforced by plaza security. Hydraulic gate closed.",
    gateLabel: "Security Gate B Pinpad",
    pinCode: "#4819",
    receiverName: "Nasser",
  },
  trafficLabel: "Traffic Clear",
  instruction: {
    maneuver: "right",
    distance: "400m",
    street: "Union Place",
    hint: "Keep right lane for ramp",
  },
  mapMeta: "1.8 MI | 8 MIN",
  gpsLabel: "Strong",
  kmLeft: 6.2,
};