import { NextStopSnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the current stop and route data
export const mockNextStop: NextStopSnapshot = {
  syncLabel: "Synced",
  tripRef: "#TRP-8420",
  stopNo: 4,
  stopTotal: 7,
  outletCode: "OUT017",
  outletName: "OUT017 Waypoint Fresh",
  address: "Central Plaza, Level B2 North Bay",
  windowStart: "06:00",
  windowEnd: "07:00",
  eta: "06:24",
  completedStops: 3,
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