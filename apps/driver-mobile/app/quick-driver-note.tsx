import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DEFAULT_DRIVER_NOTES,
  QuickDriverNoteModal,
} from '../src/components/QuickDriverNoteModal';
import { colors } from '../src/theme/tokens';

export default function QuickDriverNoteScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [selectedNote, setSelectedNote] = useState(DEFAULT_DRIVER_NOTES[0]);

  const leave = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/stops');
  };

  const handleSelect = (note: string) => {
    setSelectedNote(note);
    // Offline rule from Driver-architecture.md:
    // 1. save to SQLite  2. update UI  3. queue outbox event  4. sync later
    // TODO(feature/driver-sqlite, feature/driver-sync):
    //   await deliveryRepo.saveFailureNote(stopId, note);
    //   await outbox.enqueue({ type: 'DELIVERY_NOTE_ADDED', stopId, note });
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <QuickDriverNoteModal
        visible={visible}
        selectedNote={selectedNote}
        onSelect={handleSelect}
        onClose={leave}
      />
    </View>
  );
}