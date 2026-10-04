import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { RouteUpdateAcknowledgedModal } from '../src/components/RouteUpdateAcknowledgedModal';
import { colors } from '../src/theme/tokens';

export default function RouteUpdateScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: replace with the removed stop from the published plan revision
  // (route params or Expo SQLite).
  const removedStopNumber = 6;

  const handleContinueTrip = () => {
    // TODO(feature/driver-sqlite, feature/driver-sync): save the acknowledgement
    // locally and queue an outbox event so dispatch sees it.
    setVisible(false);
    router.replace('/stops');
  };

  const handleReviewStopSequence = () => {
    setVisible(false);
    router.replace('/stop-sequence');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <RouteUpdateAcknowledgedModal
        visible={visible}
        removedStopNumber={removedStopNumber}
        onContinueTrip={handleContinueTrip}
        onReviewStopSequence={handleReviewStopSequence}
      />
    </View>
  );
}