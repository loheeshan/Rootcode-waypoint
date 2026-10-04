import { useRouter } from "expo-router";
import { NotificationsScreen } from "../../src/features/notifications/NotificationsScreen";
import { mockNotifications } from "../../src/features/notifications/mockData";

export default function Notifications() {
  const router = useRouter();

  return (
    <NotificationsScreen
      data={mockNotifications}
      onAction={(item) => {
        if (item.kind === "route") router.push("/route-conflict");
        else if (item.kind === "photo") router.push("/photo-attention");
        else router.navigate("/today");
      }}
    />
  );
}