import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssignmentRequestSentModal } from '../src/components/AssignmentRequestSentModal';
import { colors } from '../src/theme/tokens';

export default function AssignmentSentScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: replace with the requested and blocked vehicles from the
  // assignment request (route params or API).
  const info = { requestedVehicleId: 'VEH025', blockedVehicleId: 'VEH018' };

  const handleContactDispatch = () => {
    setVisible(false);
    router.replace('/contact-dispatcher');
  };

  const handleReturnToSignIn = () => {
    setVisible(false);
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <AssignmentRequestSentModal
        visible={visible}
        requestedVehicleId={info.requestedVehicleId}
        blockedVehicleId={info.blockedVehicleId}
        onContactDispatch={handleContactDispatch}
        onReturnToSignIn={handleReturnToSignIn}
      />
    </View>
  );
}