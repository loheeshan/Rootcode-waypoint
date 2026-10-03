import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { EndShiftModal } from '../src/components/EndShiftModal';
import { colors } from '../src/theme/tokens';

export default function EndShiftScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO(feature/driver-sqlite, feature/driver-sync): replace with the real number
  // of events still waiting in the SQLite outbox.
  const pendingCount = 0;

  const handleReviewSync = () => {
    setVisible(false);
    router.replace('/sync');
  };

  const handleEndShift = () => {
    // Never sign out while records are still waiting to sync.
    if (pendingCount > 0) {
      handleReviewSync();
      return;
    }
    // TODO(feature/driver-api-integration): delete the session token from SecureStore.
    // Keep the saved trips, stops and delivery records in SQLite
    // ("Saved records stay on this phone").
    setVisible(false);
    router.replace('/login');
  };

  const handleCancel = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <EndShiftModal
        visible={visible}
        onReviewSync={handleReviewSync}
        onEndShift={handleEndShift}
        onCancel={handleCancel}
      />
    </View>
  );
}