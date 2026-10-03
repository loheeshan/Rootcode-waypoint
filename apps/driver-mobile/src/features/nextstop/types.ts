export type Maneuver = "right" | "left" | "straight";

export type TurnInstruction = {
  maneuver: Maneuver;
  distance: string; // e.g. "400m"
  street: string; // e.g. "Union Place"
  hint?: string; // e.g. "Keep right lane for ramp"
};

export type NextStopSnapshot = {
  syncLabel: string;
  tripRef: string;
  stopNo: number;
  stopTotal: number;
  outletCode: string;
  outletName: string;
  address: string;
  windowStart: string;
  windowEnd: string;
  eta: string;
  completedStops: number;
  trafficLabel: string;
  instruction: TurnInstruction;
  mapMeta: string; // e.g. "1.8 MI | 8 MIN"
  gpsLabel: string; // e.g. "Strong"
  kmLeft: number;
  progressVariant?: "range" | "recorded" | "recordedStops" | "departed"; // wording of the progress row; defaults to "range"
  departedAt?: string; // e.g. "03:30", used by the "departed" wording
  wrapTitle?: boolean; // true = the outlet name may wrap onto two lines instead of shrinking
};