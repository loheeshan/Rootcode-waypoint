import { NotificationsSnapshot } from "./types";

// TODO(feature/driver-sync): replace with the notices received from dispatch and the sync outbox
export const mockNotifications: NotificationsSnapshot = {
  vehicle: "VEH018",
  depot: "Colombo Fresh",
  syncLabel: "Synced",
  items: [
    {
      id: "n1",
      kind: "route",
      title: "Route revision · 07:04",
      body: "Dispatcher removed stop 7 from the Kandy route. Your field record is retained.",
      actionLabel: "Review route revision",
      primary: true,
    },
    {
      id: "n2",
      kind: "photo",
      title: "Photo upload needs attention",
      body: "One POD image remains on this phone.",
      actionLabel: "Review upload",
    },
    {
      id: "n3",
      kind: "loading",
      title: "Trip 2 loading in progress",
      body: "Gampaha North · Bay L2 · planned departure 05:40",
      actionLabel: "View today",
    },
  ],
};