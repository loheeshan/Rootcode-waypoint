import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ContactBayLeadModal } from '../src/components/modals/ContactBayLeadModal';
import { popupColors } from '../src/theme/popupTokens';

export default function ContactBayLeadScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  const handleShowCallHandoff = () => {
    // Prototype only: no real call is placed.
    // Later, a real handoff could use Linking.openURL(`tel:${bayLeadNumber}`).
    setVisible(false);
    router.replace('/call-handoff');
  };

  const handleClose = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <ContactBayLeadModal
        visible={visible}
        onShowCallHandoff={handleShowCallHandoff}
        onClose={handleClose}
      />
    </View>
  );
}
