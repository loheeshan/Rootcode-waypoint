import { LoginConflictSnapshot } from "./types";

// TODO(feature/driver-api-integration): conflict and units come from the sign-in response
export const mockLoginConflict: LoginConflictSnapshot = {
  hub: "Colombo Hub",
  driverId: "DRV-4018",
  pin: "8829",
  plate: "VEH018",
  depot: "Fresh Colombo",
  chamber: "Chamber -18°C",
  capacity: "24 Chill Cartons",
  conflict: {
    vehicle: "VEH018",
    startedAt: "05:40",
    otherDriverId: "DRV-3902",
    otherDriverName: "Sunil P.",
  },
  units: [
    { id: "VEH025", label: "VEH025 — Chilled Van · Colombo Hub (Ready)" },
    { id: "VEH031", label: "VEH031 — Reefer Truck · Colombo Hub (Ready)" },
    { id: "VEH044", label: "VEH044 — Chilled Van · Colombo Hub (Ready)" },
  ],
};