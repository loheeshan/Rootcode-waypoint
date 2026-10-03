import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraUnavailableModal } from '../src/components/modals/CameraUnavailableModal';
import { popupColors } from '../src/theme/popupTokens';

export default function CameraUnavailableScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const leave = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleContinueWithoutPhoto = () => {
    // Loader offline rule: save locally first, then sync later.
    // TODO(feature/loader-sqlite, feature/loader-sync):
    //   mark the missing/damaged report as "note only, no photo" in Expo SQLite
    //   and queue an outbox event.
    leave();
  };

  const handleReviewCameraSettings = async () => {
    try {
      // Opens this app's page in the phone's system settings.
      await Linking.openSettings();
    } catch {
      // Settings could not be opened; the popup stays so the loader can choose again.
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <CameraUnavailableModal
        visible={visible}
        onContinueWithoutPhoto={handleContinueWithoutPhoto}
        onReviewCameraSettings={handleReviewCameraSettings}
        onClose={leave}
      />
    </View>
  );
}