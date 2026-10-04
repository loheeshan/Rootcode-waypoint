import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { DownloadingRouteModal } from '../src/components/DownloadingRouteModal';
import { colors } from '../src/theme/tokens';

// PROTOTYPE ONLY: simulates the download taking a few seconds.
// TODO(feature/driver-sqlite, feature/driver-api-integration): replace the timer with
// the real download: GET /api/v1/driver/trips, then save trips and stops to Expo SQLite.
const SIMULATED_DOWNLOAD_MS = 3000;

export default function DownloadingRouteScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      router.replace('/today');
    }, SIMULATED_DOWNLOAD_MS);

    // Cancelling (or leaving the screen) stops the simulated download.
    return () => clearTimeout(timer);
  }, [router]);

  const handleCancel = () => {
    setVisible(false);
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <DownloadingRouteModal visible={visible} onCancel={handleCancel} />
    </View>
  );
}
