export type NotificationKind = "route" | "photo" | "loading";

export type NotificationItem = {
  id: string;
  kind: NotificationKind; // decides which screen the button opens
  title: string;
  body: string;
  actionLabel: string;
  primary?: boolean; // the blue button
};

export type NotificationsSnapshot = {
  vehicle: string;
  depot: string; // e.g. "Colombo Fresh"
  syncLabel: string;
  items: NotificationItem[];
};