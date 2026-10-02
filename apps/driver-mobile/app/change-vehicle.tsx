import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChangeVehicleModal } from '../src/components/ChangeVehicleModal';
import { colors } from '../src/theme/tokens';

export default function ChangeVehicleScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: replace with the vehicle chosen on the previous screen
  // (useLocalSearchParams) or from the API.
  const vehicle = {
    vehicleId: 'VEH025',
    vehicleType: 'chilled van',
    depotName: 'Colombo hub',
  };

  const leave = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

    const handleRequest = () => {
        // TODO(feature/driver-api-integration): send the assignment request to the API.
        // Offline rule: save locally, queue an outbox event, sync later.
    setVisible(false);
    router.replace('/assignment-sent');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <ChangeVehicleModal
        visible={visible}
        vehicleId={vehicle.vehicleId}
        vehicleType={vehicle.vehicleType}
        depotName={vehicle.depotName}
        onRequest={handleRequest}
        onCancel={leave}
      />
    </View>
  );
}
