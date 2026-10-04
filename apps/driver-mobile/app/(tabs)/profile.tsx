import { ProfileScreen } from "../../src/features/profile/ProfileScreen";
import { mockProfile } from "../../src/features/profile/mockData";
import { useRouter } from "expo-router";
const router = useRouter();

export default function Profile() {
  return (
    <ProfileScreen
      data={mockProfile}
      onSettings={() => router.push("/app-settings")}
      onNotifications={() => console.log("notifications")}
      onVehicleDetails={() => console.log("vehicle and shift details")}
      onHelp={() => console.log("help and dispatcher contact")}
      onEndShift={() => {
        // TODO(feature/driver-api-integration): confirm, check the outbox is empty, then clear the session
        console.log("end shift");
      }}
    />
  );
}