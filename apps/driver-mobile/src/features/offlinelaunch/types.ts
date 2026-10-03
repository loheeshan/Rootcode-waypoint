export type OfflineLaunchSnapshot = {
  coords: string; // e.g. "SYS.LOC // 6.9271° N 79.8612° E"
  appName: string;
  subtitle: string;
  tagline: string;
  cardTitle: string;
  cardBody: string;
  footnote: string;
  statusText: string;
  progressPct: number; // 0-100
  cacheLeft: string;
  cacheRight: string;
  network: string;
  version: string;
};