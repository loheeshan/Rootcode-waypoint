import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppPermissionsModal } from '../src/components/AppPermissionsModal';
import { colors } from '../src/theme/tokens';

export default function AppPermissionsScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleReturn = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <AppPermissionsModal visible={visible} onReturn={handleReturn} />
    </View>
  );
}