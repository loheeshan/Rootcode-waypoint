export type DeliveryOutcome = "delivered" | "partial";

export type ExceptionCode =
  | "none"
  | "damaged"
  | "short"
  | "temperature"
  | "refused";

export type ManifestIcon = "fruit-pear" | "snowflake" | "package-variant";

export type ManifestItemData = {
  id: string;
  name: string;
  lot: string;
  temp: string;
  expected: number;
  icon: ManifestIcon;
};

export type StopDeliverySnapshot = {
  vehicle: string;
  routeName: string;
  offlineSaved: number;
  stopNo: number;
  stopTotal: number;
  outlet: string;
  dock: string;
  arrival: string;
  completion: string;
  dwell: string;
  items: ManifestItemData[];
};

export type DeliveryPayload = {
  outcome: DeliveryOutcome;
  quantities: Record<string, number>;
  exceptions: Record<string, ExceptionCode>;
};