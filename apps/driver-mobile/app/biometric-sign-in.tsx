import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BiometricSignInModal } from '../src/components/BiometricSignInModal';
import { colors } from '../src/theme/tokens';

export default function BiometricSignInScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleConfirmIdentity = () => {
    // Prototype: demonstration result, so we treat it as a success.
    // TODO(feature/driver-api-integration): call expo-local-authentication,
    // then verify with the auth API and store the token in SecureStore.
    setVisible(false);
    router.replace('/today');
  };

  const handleUseShiftPin = () => {
    setVisible(false);
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <BiometricSignInModal
        visible={visible}
        onConfirmIdentity={handleConfirmIdentity}
        onUseShiftPin={handleUseShiftPin}
      />
    </View>
  );
}