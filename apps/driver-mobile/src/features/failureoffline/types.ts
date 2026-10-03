export type OfflineEvidence = {
  fileName: string;
  meta: string; // e.g. "08:14 AM • GPS: 6.9271, 79.8612"
};

export type OfflineFailureSnapshot = {
  vehicle: string;
  bannerText: string;
  queuedLabel: string;
  offlineLabel: string;
  stopNo: number;
  outletCode: string;
  tag: string;
  outletName: string;
  location: string;
  evidence: OfflineEvidence | null; // null = no photo captured yet
};