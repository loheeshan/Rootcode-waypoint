import { StopDeliverySnapshot } from "./types";

// TODO(feature/driver-sqlite): replace with the current stop read from SQLite
export const mockStop: StopDeliverySnapshot = {
  vehicle: "VEH018",
  routeName: "ROUTE NORTH",
  offlineSaved: 1,
  stopNo: 4,
  stopTotal: 7,
  outlet: "OUT017 Waypoint Fresh",
  dock: "Dock B",
  arrival: "06:22",
  completion: "06:34",
  dwell: "15m Dock B",
  items: [
    { id: "1", name: "Fresh Produce Crates", lot: "PC-994", temp: "4.1°C", expected: 6, icon: "fruit-pear" },
    { id: "2", name: "Dairy & Chilled Packs", lot: "DY-208", temp: "2.8°C", expected: 4, icon: "snowflake" },
    { id: "3", name: "Butter & Spreads", lot: "BS-310", temp: "3.4°C", expected: 2, icon: "package-variant" },
  ],
};