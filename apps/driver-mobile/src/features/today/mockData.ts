import { TodaySnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with today's trips read from SQLite
export const mockToday: TodaySnapshot = {
  driverName: "Kasun",
  greeting: "Good morning, Kasun",
  syncLabel: "Synced",
  vehicle: "VEH018",
  vehicleType: "Reefer Truck",
  tempC: "-18.2°C",
  tempLocked: true,
  dateLabel: "Wed, 18 Oct",
  outletsTotal: 12,
  trips: [
    {
      id: "t1",
      label: "Trip 1 · Fresh",
      status: "loaded",
      sector: "Colombo Metro",
      departureLabel: "DEPARTURE",
      departure: "03:30",
      stops: 7,
      weightKg: 1820,
      volume: "14.4",
      loadedBy: "Bay L4 (Rohan P.)",
      seal: "#SL-8842",
    },
    {
      id: "t2",
      label: "Trip 2 · Fresh",
      status: "waiting",
      sector: "Colombo North",
      departureLabel: "SCHEDULED DEPARTURE",
      departure: "05:45",
      stops: 5,
      weightKg: 1240,
      volume: "9.8",
    },
  ],
};