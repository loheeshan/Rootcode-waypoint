import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PhoneHandoffModal } from '../src/components/modals/PhoneHandoffModal';
import { popupColors } from '../src/theme/popupTokens';

export default function CallHandoffScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleReturn = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <PhoneHandoffModal visible={visible} onReturn={handleReturn} />
    </View>
  );
}