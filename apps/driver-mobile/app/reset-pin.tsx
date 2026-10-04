import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ResetShiftPinModal } from '../src/components/ResetShiftPinModal';
import { colors } from '../src/theme/tokens';

export default function ResetPinScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: replace with the signed-in badge / assigned desk from the API.
  const info = { deskNumber: '02', badgeId: 'DRV-4018' };

  const handleContactDispatcher = () => {
    setVisible(false);
    router.replace('/contact-dispatcher');
  };

  const handleBackToSignIn = () => {
    setVisible(false);
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <ResetShiftPinModal
        visible={visible}
        deskNumber={info.deskNumber}
        badgeId={info.badgeId}
        onContactDispatcher={handleContactDispatcher}
        onBackToSignIn={handleBackToSignIn}
      />
    </View>
  );
}