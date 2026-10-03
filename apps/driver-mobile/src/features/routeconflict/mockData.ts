import { RouteConflictSnapshot } from "./types";

// TODO(feature/driver-sync): replace with the conflict reported when the outbox synced
export const mockRouteConflict: RouteConflictSnapshot = {
  vehicle: "VEH018",
  depot: "Kandy Fresh",
  attentionCount: 1,
  stopNo: 7,
  newVehicle: "VEH050",
  arrivalAt: "07:01",
};