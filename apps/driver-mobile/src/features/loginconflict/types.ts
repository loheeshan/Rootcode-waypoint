export type ConflictInfo = {
  vehicle: string; // e.g. "VEH018"
  startedAt: string; // e.g. "05:40"
  otherDriverId: string; // e.g. "DRV-3902"
  otherDriverName: string; // e.g. "Sunil P."
};

export type AvailableUnit = {
  id: string;
  label: string; // e.g. "VEH025 — Chilled Van · Colombo Hub (Ready)"
};

export type LoginConflictSnapshot = {
  hub: string;
  driverId: string;
  pin: string;
  plate: string;
  depot: string;
  chamber: string;
  capacity: string;
  conflict: ConflictInfo;
  units: AvailableUnit[];
};