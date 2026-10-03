import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { EvidenceReadyModal } from '../src/components/modals/EvidenceReadyModal';
import { popupColors } from '../src/theme/popupTokens';

export default function EvidenceReadyScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // PROTOTYPE ONLY: sample data from the design.
  // TODO(feature/loader-sqlite): replace with the photo that was just captured
  // (route params or Expo SQLite).
  const evidence = {
    description: 'damaged crate and order label at Bay B-04',
    fileName: 'POD_BAY04_0312.jpg',
    capturedAt: '03:12',
  };

  const leave = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleUseEvidence = () => {
    // Loader offline rule: save locally first, then sync later.
    // TODO(feature/loader-sqlite, feature/loader-sync):
    //   attach the photo to the missing/damaged item in Expo SQLite and queue an outbox event.
    //   The UI should then show "Saved on device / Dispatcher has not received this yet".
    leave();
  };

  const handleRetake = () => {
    setVisible(false);
    router.replace('/evidence-photo');
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <EvidenceReadyModal
        visible={visible}
        description={evidence.description}
        fileName={evidence.fileName}
        capturedAt={evidence.capturedAt}
        onUseEvidence={handleUseEvidence}
        onRetake={handleRetake}
        onClose={leave}
      />
    </View>
  );
}