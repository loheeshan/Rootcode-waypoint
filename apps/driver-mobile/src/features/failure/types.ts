export type FailureReasonCode =
  | "closed"
  | "blocked"
  | "no_receiver"
  | "damaged"
  | "rejected"
  | "window_missed"
  | "other";

export type FailureEvidence = {
  caption: string;
  meta: string;
};

export type FailureStopSnapshot = {
  vehicle: string;
  syncLabel: string;
  stopNo: number;
  outletCode: string;
  tag: string;
  outletName: string;
  location: string;
  evidence: FailureEvidence | null; // null = no photo captured yet
};

export type FailurePayload = {
  reason: FailureReasonCode;
  photoAttached: boolean;
};