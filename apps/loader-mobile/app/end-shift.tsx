import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { EndShiftModal } from '../src/components/modals/EndShiftModal';
import { popupColors } from '../src/theme/popupTokens';
import { LOGIN, useAuth } from '../src/services/auth';

export default function EndShiftScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [visible, setVisible] = useState(true);

  const handleSignOut = async () => {
    // Deletes the SecureStore token; the local queue stays in Expo SQLite for the next sign-in.
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
      />
    </View>
  );
}