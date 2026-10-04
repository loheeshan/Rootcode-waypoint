import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PreferenceSavedModal } from '../src/components/modals/PreferenceSavedModal';
import { popupColors } from '../src/theme/popupTokens';

export default function PreferenceSavedScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleBackToSettings = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/'); // TODO: point at the Loader settings screen once its route exists
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <PreferenceSavedModal visible={visible} onBackToSettings={handleBackToSettings} />
    </View>
  );
}