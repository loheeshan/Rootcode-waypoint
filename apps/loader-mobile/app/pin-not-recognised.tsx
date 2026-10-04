import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PinNotRecognisedModal } from '../src/components/modals/PinNotRecognisedModal';
import { popupColors } from '../src/theme/popupTokens';

// PROTOTYPE ONLY: the design shows a demo PIN hint.
// TODO(feature/loader-api-integration): verify PINs with the auth API and remove this hint.
const DEMO_PIN = '0426';

export default function PinNotRecognisedScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleTryAgain = () => {
    setVisible(false);
    router.replace('/'); // use '/login' if the Loader app has a login route
  };

  const handleGetHelp = () => {
    setVisible(false);
    router.replace('/contact-bay-lead');
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <PinNotRecognisedModal
        visible={visible}
        demoPin={DEMO_PIN}
        onTryAgain={handleTryAgain}
        onGetHelp={handleGetHelp}
      />
    </View>
  );
}