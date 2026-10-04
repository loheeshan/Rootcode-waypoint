import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccessWindowClosedModal } from '../src/components/AccessWindowClosedModal';
import { colors } from '../src/theme/tokens';

export default function AccessWindowClosedScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: replace with the current stop's access window from Expo SQLite.
  const opensAt = '09:00';

  const handleReturnToStop = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/stops');
  };

  const handleContactDispatch = () => {
    setVisible(false);
    router.replace('/contact-dispatcher');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <AccessWindowClosedModal
        visible={visible}
        opensAt={opensAt}
        onReturnToStop={handleReturnToStop}
        onContactDispatch={handleContactDispatch}
      />
    </View>
  );
}