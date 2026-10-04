import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { VehicleIssueReportedModal } from '../src/components/VehicleIssueReportedModal';
import { colors } from '../src/theme/tokens';

export default function VehicleIssueReportedScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleReturnToVehicleStatus = () => {
    setVisible(false);
    router.replace('/vehicle-status');
  };

  const handleContactDispatch = () => {
    setVisible(false);
    router.replace('/contact-dispatcher');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <VehicleIssueReportedModal
        visible={visible}
        onReturnToVehicleStatus={handleReturnToVehicleStatus}
        onContactDispatch={handleContactDispatch}
      />
    </View>
  );
}