import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ReturnToDepotModal } from '../src/components/ReturnToDepotModal';
import { colors } from '../src/theme/tokens';

export default function ReturnToDepotScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: replace with the vehicle of the current trip from Expo SQLite.
  const vehicleId = 'VEH018';

  const handleViewCompletedRoute = () => {
    setVisible(false);
    router.replace('/completed-route');
  };

  const handleContactDispatch = () => {
    setVisible(false);
    router.replace('/contact-dispatcher');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <ReturnToDepotModal
        visible={visible}
        vehicleId={vehicleId}
        onViewCompletedRoute={handleViewCompletedRoute}
        onContactDispatch={handleContactDispatch}
      />
    </View>
  );
}