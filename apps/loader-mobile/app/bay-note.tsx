import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BayNoteModal } from '../src/components/modals/BayNoteModal';
import { popupColors } from '../src/theme/popupTokens';

export default function BayNoteScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const leave = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleSelect = (note: string | null) => {
    if (note) {
      // Loader offline rule: save locally first, then sync later.
      // TODO(feature/loader-sqlite, feature/loader-sync):
      //   save the note on the missing/damaged item in Expo SQLite and queue an outbox event.
      //   The UI should then show "Saved on device / Dispatcher has not received this yet".
    }
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <BayNoteModal visible={visible} onSelect={handleSelect} onClose={leave} />
    </View>
  );
}