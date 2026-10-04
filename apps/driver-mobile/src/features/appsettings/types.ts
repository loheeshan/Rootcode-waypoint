export type AppSettingsSnapshot = {
  vehicle: string;
  depot: string; // e.g. "Colombo Fresh"
  syncLabel: string;
  notificationsOn: boolean;
  language: string; // e.g. "English"
  storedRecords: number; // records waiting on this phone
  permissions: string; // e.g. "Camera and location"
};