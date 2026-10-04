import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  NotificationPreference,
  NotificationPreferencesModal,
} from '../src/components/modals/NotificationPreferencesModal';
import { popupColors } from '../src/theme/popupTokens';

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const leave = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleSelectPreference = (preference: NotificationPreference) => {
    // TODO(feature/loader-sqlite): save the preference on the device
    // (SecureStore or Expo SQLite).
    // Whatever is chosen, critical loading changes must stay visible in the app.
    console.log('notification preference', preference);
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <NotificationPreferencesModal
        visible={visible}
        onSelectPreference={handleSelectPreference}
        onClose={leave}
      />
    </View>
  );
}