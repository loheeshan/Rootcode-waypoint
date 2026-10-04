import { TripSnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the active trip read from SQLite
export const mockTrip: TripSnapshot = {
  driverName: "Kasun",
  vehicle: "VEH018",
  syncLabel: "Synced",
  routeRevision: "Dispatcher updated your route: stop 6 removed.",
  tripLabel: "Trip 1",
  routeName: "Colombo Fresh Route",
  tripStatus: "Active",
  cargoKg: 1820,
  cargoVolume: "14.4m³",
  stops: [
    { id: "s1", stopNo: 1, outlet: "Cargills FoodCity Kollupitiya", windowStart: "04:00", windowEnd: "04:45", status: "delivered", doneAt: "04:18" },
    { id: "s2", stopNo: 2, outlet: "Food City Express Bambalapitiya", windowStart: "04:50", windowEnd: "05:30", status: "delivered", doneAt: "05:05" },
    { id: "s3", stopNo: 3, outlet: "Arpico Supercentre Havelock", windowStart: "05:35", windowEnd: "06:15", status: "partial", doneAt: "05:52" },
    { id: "s4", stopNo: 4, outlet: "OUT017 Waypoint Fresh", windowStart: "06:20", windowEnd: "07:00", status: "current" },
    { id: "s5", stopNo: 5, outlet: "Keells Super Wellawatte", windowStart: "07:10", windowEnd: "07:50", status: "upcoming" },
    { id: "s6", stopNo: 6, outlet: "Cargills FoodCity Dehiwala", windowStart: "08:00", windowEnd: "08:40", status: "upcoming" },
    { id: "s7", stopNo: 7, outlet: "Laugfs Super Mount Lavinia", windowStart: "08:50", windowEnd: "09:30", status: "upcoming" },
  ],
};