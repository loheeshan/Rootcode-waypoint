import { ProfileScreen } from "../../src/features/profile/ProfileScreen";
import { mockProfile } from "../../src/features/profile/mockData";
import { useRouter } from "expo-router";

export default function Profile() {
  const router = useRouter();
  return (
    <ProfileScreen
      data={mockProfile}
      onSettings={() => router.push("/app-settings")}
      onNotifications={() => router.push("/notifications")}
      onVehicleDetails={() => router.push("/vehicle-shift")}
      onHelp={() => console.log("help and dispatcher contact")}
      // The end-shift screen confirms, keeps unsynced records and clears the session.
      onEndShift={() => router.push("/end-shift")}
    />
  );
}
