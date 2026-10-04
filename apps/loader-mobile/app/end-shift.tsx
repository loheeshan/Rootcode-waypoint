import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { EndShiftModal } from '../src/components/modals/EndShiftModal';
import { popupColors } from '../src/theme/popupTokens';

export default function EndShiftScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleSignOut = () => {
    // TODO(feature/loader-api-integration): delete the session token from SecureStore.
    // Keep the saved trips and the outbox in Expo SQLite, because the popup says
    // "Any local queue remains saved on this device for the next authorised sign-in".
    setVisible(false);
    router.replace('/'); // use '/login' if the Loader app has a login route
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
      />
    </View>
  );
}