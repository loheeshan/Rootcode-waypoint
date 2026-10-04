import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DEFAULT_LANGUAGES,
  InterfaceLanguageModal,
} from '../src/components/modals/InterfaceLanguageModal';
import { popupColors } from '../src/theme/popupTokens';

export default function InterfaceLanguageScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO(feature/loader-sqlite): read the saved language from SecureStore / Expo SQLite.
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGES[0]);

  const leave = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleSelect = (language: string) => {
    setSelectedLanguage(language);
    // TODO(feature/loader-sqlite): save the chosen language on the device.
    // Translating the app text is a separate feature.
    console.log('language chosen', language);
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: popupColors.overlay }}>
      <InterfaceLanguageModal
        visible={visible}
        selectedLanguage={selectedLanguage}
        onSelect={handleSelect}
        onClose={leave}
      />
    </View>
  );
}