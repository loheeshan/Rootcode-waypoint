import { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FailureReasonCode } from "../failure/types";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export const REASON_ICONS: Record<FailureReasonCode, IconName> = {
  closed: "lock-outline",
  blocked: "cancel",
  no_receiver: "account-outline",
  damaged: "cube-outline",
  rejected: "close-circle-outline",
  window_missed: "clock-outline",
  other: "alert-outline",
};