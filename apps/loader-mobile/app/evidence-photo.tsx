import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { EvidencePhotoModal } from '../src/components/modals/EvidencePhotoModal';
import { popupColors } from '../src/theme/popupTokens';

export default function EvidencePhotoScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const leave = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

   const handleTakeSamplePhoto = () => {
    // Simulated capture. The real save to SQLite happens when the evidence is accepted
    // on the next popup (see app/evidence-ready.tsx).
    setVisible(false);
    router.replace('/evidence-ready');
  };
  const handlePermissionDenied = () => {
    // Simulates the camera permission being denied.
    // TODO: show camera permission guidance (design needed) instead of just leaving.
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <EvidencePhotoModal
        visible={visible}
        onTakeSamplePhoto={handleTakeSamplePhoto}
        onPermissionDenied={handlePermissionDenied}
        onClose={leave}
      />
    </View>
  );
}