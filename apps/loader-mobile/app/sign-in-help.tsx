import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SignInHelpModal } from '../src/components/modals/SignInHelpModal';
import { popupColors } from '../src/theme/popupTokens';
import { LOGIN } from '../src/services/auth';

export default function SignInHelpScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleBackToSignIn = () => {
    setVisible(false);
    router.replace(LOGIN);
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <SignInHelpModal visible={visible} onBackToSignIn={handleBackToSignIn} />
    </View>
  );
}