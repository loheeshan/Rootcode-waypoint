import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShiftPinModal } from '../src/components/ShiftPinModal';
import { colors } from '../src/theme/tokens';

// PROTOTYPE ONLY: the design uses a sample PIN.
// TODO(feature/driver-api-integration): remove this and verify the PIN with the
// auth API, then store the token in SecureStore. Never ship a hardcoded PIN.
const SAMPLE_PIN = '8829';

export default function EnterPinScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleSubmit = (pin: string) => {
    setVisible(false);
    if (pin === SAMPLE_PIN) {
      router.replace('/today');
    } else {
      router.replace('/sign-in-error');
    }
  };

  const handleClose = () => {
    setVisible(false);
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <ShiftPinModal
        visible={visible}
        hint={`Use the sample shift PIN ${SAMPLE_PIN}.`}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    </View>
  );
}