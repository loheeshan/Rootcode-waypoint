import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { EndShiftModal } from '../src/components/modals/EndShiftModal';
import { popupColors } from '../src/theme/popupTokens';
import { LOGIN, useAuth } from '../src/services/auth';
import { useSync } from '../src/sync/SyncProvider';

export default function EndShiftScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { counts } = useSync();
  const [visible, setVisible] = useState(true);

  const handleSignOut = async () => {
    // Deletes the SecureStore token. Unsent events stay in SQLite under this user's ID and are sent
    // only after this same account signs in again.
    setVisible(false);
    await signOut();
    router.replace(LOGIN);
  };

  const handleKeepWorking = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <EndShiftModal
        visible={visible}
        onSignOut={handleSignOut}
        onKeepWorking={handleKeepWorking}
        unsent={counts.pending + counts.syncing + counts.failed}
      />
    </View>
  );
}