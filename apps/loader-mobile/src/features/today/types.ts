export type LoadCategory = 'fresh' | 'style' | 'tech';

export interface PlanUpdate {
  revision: number;
  message: string;
}

export interface LoaderTrip {
  id: string;
  vehicleCode: string; // "VEH018"
  tripNo: number;
  category: LoadCategory;
  vehicleType: string; // "Reefer Truck"
  route: string | null; // "Colombo Route"
  departsAt: string; // "03:30"
  minutesToDeparture: number;
  stopsLoaded: number;
  totalStops: number;
  payloadKg: number;
  volumeM3: number;
  dock: string; // "Dock Bay B-07"
  planUpdate?: PlanUpdate;
}

export interface LivePlan {
  revision: number;
  updatedAt: string; // "22:10 IST"
  facility: string;
  activeDocks: string; // "Bay B-04 / B-08"
}

export type TripFilter = 'all' | LoadCategory;