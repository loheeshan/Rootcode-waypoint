import { ProfileSnapshot } from "./types";

// TODO(feature/driver-api-integration): replace with the signed-in driver's profile
export const mockProfile: ProfileSnapshot = {
  vehicle: "VEH018",
  depot: "Colombo Fresh",
  syncLabel: "Synced",
  name: "Kasun Perera",
  driverId: "DRV-4018",
  homeDepot: "Colombo depot",
  vehicleType: "Reefer Truck",
};