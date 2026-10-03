import { OfflineLaunchSnapshot } from "./types";

// TODO(feature/driver-sync): drive progressPct and statusText from the real connection check
export const mockOfflineLaunch: OfflineLaunchSnapshot = {
  coords: "SYS.LOC // 6.9271° N 79.8612° E",
  appName: "Waypoint",
  subtitle: "DRIVER LOGISTICS OS",
  tagline: "Smarter Deliveries. Stronger Tomorrow.",
  cardTitle: "Internet Connection Required",
  cardBody:
    "No connection detected. First-time sign-in requires an active internet connection to download local route manifest and authenticate.",
  footnote: "Once signed in, you'll be able to work offline.",
  statusText: "Awaiting network handshake...",
  progressPct: 0,
  cacheLeft: "CACHE: NO CREDENTIALS FOUND",
  cacheRight: "LOCAL STORE READY",
  network: "Sri Lanka Fleet Network",
  version: "v2.4.0 (Build 884)",
};