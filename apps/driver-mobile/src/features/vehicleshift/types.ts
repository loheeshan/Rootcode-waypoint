export type VehicleShiftSnapshot = {
  vehicle: string;
  depot: string; // header depot, e.g. "Colombo Fresh"
  syncLabel: string;
  vehicleType: string; // e.g. "Reefer Truck"
  driverName: string; // e.g. "Kasun"
  driverId: string; // e.g. "DRV-4018"
  fleet: string; // e.g. "Fresh Colombo"
  shiftStatus: string; // e.g. "active shift"
  chilledLock: string; // e.g. "−18°C"
  battery: string; // e.g. "28.4 V"
  fuelPercent: number; // e.g. 88
  seal: string; // e.g. "SL-8842"
};