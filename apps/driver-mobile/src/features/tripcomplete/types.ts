export type TripCompleteSnapshot = {
  vehicle: string;
  depot: string; // e.g. "Colombo Fresh"
  syncLabel: string;
  tripLabel: string; // e.g. "Trip 1"
  activeStops: number; // stops that were finished
  removedStop?: number; // stop removed by dispatch, if any
  departure: string; // e.g. "03:30"
  finalCapture: string; // e.g. "08:54"
};