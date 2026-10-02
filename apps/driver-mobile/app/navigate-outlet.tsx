import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { NavigateOutletModal } from '../src/components/NavigateOutletModal';
import { colors } from '../src/theme/tokens';

export default function NavigateOutletScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: replace with the current stop from Expo SQLite.
  const stop = { outletName: 'Union Place', accessNote: 'rear dock Gate B' };

  const handleConfirm = () => {
    setVisible(false);
    router.replace('/navigation-preview');
  };

  const handleCancel = () => {
    setVisible(false);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <NavigateOutletModal
        visible={visible}
        outletName={stop.outletName}
        accessNote={stop.accessNote}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </View>
  );
}