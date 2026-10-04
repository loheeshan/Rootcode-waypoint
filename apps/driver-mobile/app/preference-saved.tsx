import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PreferenceSavedModal } from '../src/components/PreferenceSavedModal';
import { colors } from '../src/theme/tokens';

export default function PreferenceSavedScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: pass the changed preference from the Profile screen
  // (useLocalSearchParams) and save it to Expo SQLite / SecureStore.
  const preferenceName = 'Notifications';

  const handleDone = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <PreferenceSavedModal
        visible={visible}
        preferenceName={preferenceName}
        onDone={handleDone}
      />
    </View>
  );
}