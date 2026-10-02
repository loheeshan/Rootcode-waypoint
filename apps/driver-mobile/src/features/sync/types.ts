export type QueueStatus = "delivered" | "partial";

export type QueueItemData = {
  id: string;
  stopNo: number;
  outlet: string;
  status: QueueStatus;
  partialLabel?: string; // e.g. "Partial 8/10"
  time: string; // local capture time, e.g. "06:24"
};

export type SyncSnapshot = {
  vehicle: string;
  depot: string;
  corridor: string;
  offlineSince: string;
  offlineDuration: string;
  offlineRegion: string;
  signalText: string;
  signalPct: number;
  items: QueueItemData[];
  dispatcherLastHeard: string;
};