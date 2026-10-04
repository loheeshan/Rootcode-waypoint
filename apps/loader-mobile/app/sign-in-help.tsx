import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SignInHelpModal } from '../src/components/modals/SignInHelpModal';
import { popupColors } from '../src/theme/popupTokens';

export default function SignInHelpScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleBackToSignIn = () => {
    setVisible(false);
    router.replace('/'); // use '/login' if the Loader app has a login route
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <SignInHelpModal visible={visible} onBackToSignIn={handleBackToSignIn} />
    </View>
  );
}