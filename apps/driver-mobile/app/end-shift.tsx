import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { EndShiftModal } from '../src/components/EndShiftModal';
import { colors } from '../src/theme/tokens';
import { LOGIN, useAuth } from '../src/services/auth';
import { useSync } from '../src/sync/SyncProvider';

export default function EndShiftScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { counts } = useSync();
  const [visible, setVisible] = useState(true);

  // TODO(feature/driver-sqlite, feature/driver-sync): replace with the real number
  // of events still waiting in the SQLite outbox.
  const pendingCount = 0;

  const handleReviewSync = () => {
    setVisible(false);
    router.replace('/sync');
  };

  const handleEndShift = async () => {
    // Never sign out while records are still waiting to sync.
    if (pendingCount > 0) {
      handleReviewSync();
      return;
    }
    // Deletes the SecureStore token; saved trips and records stay on this phone.
    setVisible(false);
    await signOut();
    router.replace(LOGIN);
  };

  const handleCancel = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <EndShiftModal
        unsent={counts.pending + counts.syncing + counts.failed}
        visible={visible}
        onReviewSync={handleReviewSync}
        onEndShift={handleEndShift}
        onCancel={handleCancel}
      />
    </View>
  );
}