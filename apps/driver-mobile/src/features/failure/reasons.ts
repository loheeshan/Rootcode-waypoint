import { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FailureReasonCode } from "./types";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type ReasonDef = {
  code: FailureReasonCode;
  label: string;
  icon: IconName;
  size: "wide" | "compact";
  evidencePrompt: string;
};

// Order matters: wide rows first, then the 2-column tiles (matches the design)
export const REASONS: ReasonDef[] = [
  {
    code: "closed",
    label: "Store Closed / Locked",
    icon: "lock-outline",
    size: "wide",
    evidencePrompt: "TAKE PHOTO OF CLOSED STORE / LOCK",
  },
  {
    code: "blocked",
    label: "Access Blocked / Dock Obstructed",
    icon: "cancel",
    size: "wide",
    evidencePrompt: "TAKE PHOTO OF CLOSED GATE / OBSTRUCTION",
  },
  {
    code: "no_receiver",
    label: "No One to Receive",
    icon: "account-off-outline",
    size: "wide",
    evidencePrompt: "TAKE PHOTO OF STORE FRONT / DOCK",
  },
  {
    code: "damaged",
    label: "Goods Damaged in Transit",
    icon: "archive-outline",
    size: "compact",
    evidencePrompt: "TAKE PHOTO OF DAMAGED GOODS",
  },
  {
    code: "rejected",
    label: "Delivery Rejected by Store",
    icon: "close-circle-outline",
    size: "compact",
    evidencePrompt: "TAKE PHOTO OF REJECTION NOTE",
  },
  {
    code: "window_missed",
    label: "Mall Loading Window Missed",
    icon: "clock-outline",
    size: "compact",
    evidencePrompt: "TAKE PHOTO OF LOADING WINDOW SIGN",
  },
  {
    code: "other",
    label: "Other / Road Impasse",
    icon: "traffic-cone",
    size: "compact",
    evidencePrompt: "TAKE PHOTO OF THE SITUATION",
  },
];