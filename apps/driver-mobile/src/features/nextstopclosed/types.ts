import { TurnInstruction } from "../nextstop/types";

export type AccessClosedInfo = {
  dock: string; // e.g. "REAR_DOCK"
  currentTime: string; // e.g. "08:15"
  waitMinutes: number; // e.g. 45
  opensAt: string; // e.g. "09:00"
  waitNote: string;
  gateLabel: string; // e.g. "Security Gate B Pinpad"
  pinCode: string; // e.g. "#4819"
  receiverName: string; // e.g. "Nasser"
};

export type NextStopClosedSnapshot = {
  initials: string;
  tripRef: string;
  syncLabel: string;
  stopNo: number;
  stopTotal: number;
  outletCode: string;
  outletName: string;
  address: string;
  windowStart: string;
  windowEnd: string;
  eta: string;
  completedStops: number;
  access: AccessClosedInfo;
  trafficLabel: string;
  instruction: TurnInstruction;
  mapMeta: string;
  gpsLabel: string;
  kmLeft: number;
};