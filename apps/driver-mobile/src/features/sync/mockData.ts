import { SyncSnapshot } from "./types";

// TODO(feature/driver-sync): replace with data read from the SQLite outbox
export const mockSync: SyncSnapshot = {
  vehicle: "VEH018",
  depot: "Kandy Fresh",
  corridor: "Kandy corridor",
  offlineSince: "06:12",
  offlineDuration: "50m",
  offlineRegion: "Hill Country",
  signalText: "Signal: Dead zone (GPRS reconnecting...)",
  signalPct: 0,
  dispatcherLastHeard: "06:12",
  items: [
    { id: "1", stopNo: 4, outlet: "OUT088", status: "delivered", time: "06:24" },
    { id: "2", stopNo: 5, outlet: "OUT091", status: "partial", partialLabel: "Partial 8/10", time: "06:41" },
    { id: "3", stopNo: 6, outlet: "OUT093", status: "delivered", time: "06:58" },
  ],
};