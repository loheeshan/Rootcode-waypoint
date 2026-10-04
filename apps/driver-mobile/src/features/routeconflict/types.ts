export type RouteConflictSnapshot = {
  vehicle: string;
  depot: string; // e.g. "Kandy Fresh"
  attentionCount: number; // items that need attention, shown in the header pill
  stopNo: number; // the stop that was moved
  newVehicle: string; // the vehicle it was reassigned to
  arrivalAt: string; // phone-captured arrival time, e.g. "07:01"
};