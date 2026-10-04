import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraAccessModal } from '../src/components/modals/CameraAccessModal';
import { popupColors } from '../src/theme/popupTokens';

export default function CameraAccessScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleAllowCamera = () => {
    // Prototype only: the permission is simulated.
    // TODO(feature/loader-api-integration): request the real permission,
    // e.g. with expo-camera or expo-image-picker.
    setVisible(false);
    router.replace('/evidence-photo');
  };

  const handleContinueWithoutCamera = () => {
    // Loading and issue notes stay available without a camera.
    // TODO(feature/loader-sqlite): remember the choice so the app doesn't ask again.
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <CameraAccessModal
        visible={visible}
        onAllowCamera={handleAllowCamera}
        onContinueWithoutCamera={handleContinueWithoutCamera}
      />
    </View>
  );
}