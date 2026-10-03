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
    // Loader offline rule: save locally first, then sync later.
    // TODO(feature/loader-sqlite, feature/loader-sync):
    //   save the sample photo reference to Expo SQLite and queue an outbox event.
    //   The UI should then show "Saved on device / Dispatcher has not received this yet".
    leave();
  };

  const handlePermissionDenied = () => {
    // Simulates the camera permission being denied.
    setVisible(false);
    router.replace('/camera-unavailable');
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