import { useState } from "react";
import { OfflineLaunchScreen } from "../src/features/offlinelaunch/OfflineLaunchScreen";
import { mockOfflineLaunch } from "../src/features/offlinelaunch/mockData";

export default function OfflineLaunch() {
  const [retrying, setRetrying] = useState(false);

  return (
    <OfflineLaunchScreen
      data={mockOfflineLaunch}
      retrying={retrying}
      onRetry={() => {
        // TODO(feature/driver-sync): check NetInfo; if online, go to /login, else stay here
        setRetrying(true);
        setTimeout(() => setRetrying(false), 1200);
      }}
    />
  );
}