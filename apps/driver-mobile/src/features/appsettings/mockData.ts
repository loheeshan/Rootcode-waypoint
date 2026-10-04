import { AppSettingsSnapshot } from "./types";

// TODO(feature/driver-sqlite): the stored record count comes from the outbox
export const mockAppSettings: AppSettingsSnapshot = {
  vehicle: "VEH018",
  depot: "Colombo Fresh",
  syncLabel: "Synced",
  notificationsOn: true,
  language: "English",
  storedRecords: 3,
  permissions: "Camera and location",
};