import { ExceptionCode } from "./types";

export const EXCEPTION_OPTIONS: { code: ExceptionCode; label: string }[] = [
  { code: "none", label: "No Exception (Good)" },
  { code: "damaged", label: "Damaged" },
  { code: "short", label: "Short supplied" },
  { code: "temperature", label: "Temperature breach" },
  { code: "refused", label: "Refused by outlet" },
];