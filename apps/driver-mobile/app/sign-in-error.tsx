import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SignInUnsuccessfulModal } from '../src/components/SignInUnsuccessfulModal';
import { colors } from '../src/theme/tokens';

export default function SignInErrorScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleTryAgain = () => {
    setVisible(false);
    router.replace('/login');
  };

  const handleForgotPin = () => {
    setVisible(false);
    router.replace('/reset-pin');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <SignInUnsuccessfulModal
        visible={visible}
        onTryAgain={handleTryAgain}
        onForgotPin={handleForgotPin}
      />
    </View>
  );
}