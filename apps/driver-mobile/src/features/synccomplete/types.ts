export type SyncedRecord = {
  id: string;
  stopNo: number;
  outlet: string; // e.g. "OUT088"
  outcome: "delivered" | "partial";
  partialLabel?: string; // e.g. "Partial 8/10"
  capturedAt: string; // phone capture time, e.g. "06:24"
  sentAt: string; // time it reached the server, e.g. "07:04"
};

export type RouteUpdate = {
  title: string;
  body: string;
};

export type SyncCompleteSnapshot = {
  vehicle: string;
  depot: string; // e.g. "Kandy Fresh"
  syncLabel: string;
  sentAt: string; // e.g. "07:04"
  routeUpdate: RouteUpdate | null; // null = no route update card
  records: SyncedRecord[];
};