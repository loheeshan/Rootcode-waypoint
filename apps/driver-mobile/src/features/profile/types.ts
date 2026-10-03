export type ProfileSnapshot = {
  vehicle: string;
  depot: string; // header depot, e.g. "Colombo Fresh"
  syncLabel: string;
  name: string;
  driverId: string; // e.g. "DRV-4018"
  homeDepot: string; // e.g. "Colombo depot"
  vehicleType: string; // e.g. "Reefer Truck"
};