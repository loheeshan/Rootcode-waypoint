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
// TODO(feature/driver-sqlite): the next stop is read from SQLite after a record is saved
export const mockNextStopAfterSave: NextStopSnapshot = {
  ...mockNextStop,
  stopNo: 5,
  outletCode: "OUT021",
  outletName: "OUT021 Cargills Express Borella",
  address: "Borella · rear receiving entrance",
  windowStart: "07:15",
  windowEnd: "08:00",
  eta: "07:22",
  completedStops: 4,
  progressVariant: "recorded",
};

// TODO(feature/driver-sqlite): the final stop is read from SQLite once every earlier stop has a record
export const mockNextStopLast: NextStopSnapshot = {
  ...mockNextStop,
  stopNo: 7,
  outletCode: "OUT029",
  outletName: "OUT029 Glomark Kotte",
  address: "Kotte · rear receiving dock",
  windowStart: "08:30",
  windowEnd: "09:15",
  eta: "08:42",
  completedStops: 5,
  progressVariant: "recorded",
};