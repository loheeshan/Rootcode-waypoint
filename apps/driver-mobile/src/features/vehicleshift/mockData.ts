import { VehicleShiftSnapshot } from "./types";

// TODO(feature/driver-api-integration): vehicle and shift come from the sign-in response,
// the pre-trip readings come from the pre-trip check done at the depot
export const mockVehicleShift: VehicleShiftSnapshot = {
  vehicle: "VEH018",
  depot: "Colombo Fresh",
  syncLabel: "Synced",
  vehicleType: "Reefer Truck",
  driverName: "Kasun",
  driverId: "DRV-4018",
  fleet: "Fresh Colombo",
  shiftStatus: "active shift",
  chilledLock: "−18°C",
  battery: "28.4 V",
  fuelPercent: 88,
  seal: "SL-8842",
};