import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppLanguageModal } from '../src/components/AppLanguageModal';
import { colors } from '../src/theme/tokens';

export default function AppLanguageScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: read the saved language from Expo SQLite / SecureStore.
  const languageName = 'English';

  const handleKeep = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <AppLanguageModal
        visible={visible}
        languageName={languageName}
        onKeep={handleKeep}
      />
    </View>
  );
}