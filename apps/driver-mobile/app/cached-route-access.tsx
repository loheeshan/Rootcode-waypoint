import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CachedRouteAccessModal } from '../src/components/CachedRouteAccessModal';
import { colors } from '../src/theme/tokens';

export default function CachedRouteAccessScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleOpenCachedTrip = () => {
    // TODO(feature/driver-sqlite): check SecureStore for a cached credential
    // and SQLite for a downloaded trip before opening it offline.
    setVisible(false);
    router.replace('/today');
  };

  const handleNoCachedCredentials = () => {
    setVisible(false);
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <CachedRouteAccessModal
        visible={visible}
        onOpenCachedTrip={handleOpenCachedTrip}
        onNoCachedCredentials={handleNoCachedCredentials}
      />
    </View>
  );
}