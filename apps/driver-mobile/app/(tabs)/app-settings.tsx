import { useState } from "react";
import { useRouter } from "expo-router";
import { AppSettingsScreen } from "../../src/features/appsettings/AppSettingsScreen";
import { mockAppSettings } from "../../src/features/appsettings/mockData";

export default function AppSettings() {
  const router = useRouter();
  // TODO: save this on the phone so it survives closing the app
  const [notificationsOn, setNotificationsOn] = useState(mockAppSettings.notificationsOn);

  return (
    <AppSettingsScreen
      data={mockAppSettings}
      notificationsOn={notificationsOn}
      onToggleNotifications={() => setNotificationsOn((v) => !v)}
      onLanguage={() => console.log("language")}
      onOfflineStorage={() => console.log("offline storage")}
      onPermissions={() => console.log("permissions")}
      onBack={() => router.navigate("/profile")}
    />
  );
}