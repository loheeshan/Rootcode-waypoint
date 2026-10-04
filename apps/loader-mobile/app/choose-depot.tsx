import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChooseDepotModal } from '../src/components/modals/ChooseDepotModal';
import { popupColors } from '../src/theme/popupTokens';

// PROTOTYPE ONLY: depot names from the design.
// TODO(feature/loader-api-integration): load the depots this loader may work at from the API.
const PRIMARY_DEPOT = 'Peliyagoda Central Depot';
const SECONDARY_DEPOT = 'Kandy · remote coverage';

export default function ChooseDepotScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleSelectDepot = (depot: string) => {
    // TODO(feature/loader-sqlite): save the chosen depot on the device
    // (SecureStore or Expo SQLite) so the Assigned Trips screen can filter by it.
    console.log('depot chosen', depot);
    setVisible(false);
    router.replace('/'); // TODO: go to the Assigned Trips screen once its route is known
  };

  const handleClose = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <ChooseDepotModal
        visible={visible}
        primaryDepot={PRIMARY_DEPOT}
        secondaryDepot={SECONDARY_DEPOT}
        onSelectDepot={handleSelectDepot}
        onClose={handleClose}
      />
    </View>
  );
}