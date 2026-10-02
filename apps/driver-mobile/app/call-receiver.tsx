import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CallReceiverModal } from '../src/components/CallReceiverModal';
import { colors } from '../src/theme/tokens';

export default function CallReceiverScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: replace with the current stop's receiver from Expo SQLite.
  const receiver = {
    contactName: 'Nasser',
    deskLabel: 'OUT017 receiving desk',
    locationNote: 'Gate B, rear dock',
  };

  const handleConfirm = () => {
    setVisible(false);
    router.replace('/call-handoff');
  };

  const handleCancel = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <CallReceiverModal
        visible={visible}
        contactName={receiver.contactName}
        deskLabel={receiver.deskLabel}
        locationNote={receiver.locationNote}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </View>
  );
}