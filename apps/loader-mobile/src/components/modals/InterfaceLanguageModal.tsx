import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  popupColors as colors,
  popupRadius as radius,
  popupSpacing as spacing,
} from '../../theme/popupTokens';

export const DEFAULT_LANGUAGES = ['English', 'Sinhala', 'Tamil'];

type Props = {
  visible: boolean;
  languages?: string[];
  /** The currently selected language (shown in blue). */
  selectedLanguage: string;
  onSelect: (language: string) => void;
  onClose: () => void;
};

export function InterfaceLanguageModal({
  visible,
  languages = DEFAULT_LANGUAGES,
  selectedLanguage,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Interface language
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.body}>
            Choose the language preference for this device.
          </Text>

          {languages.map((language, index) => {
            const selected = language === selectedLanguage;
            return (
              <Pressable
                key={language}
                onPress={() => onSelect(language)}
                style={({ pressed }) => [
                  styles.option,
                  index > 0 && styles.optionSpacing,
                  selected ? styles.optionSelected : styles.optionDefault,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: selected ? colors.primaryText : colors.textPrimary },
                  ]}
                >
                  {language}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
    marginRight: spacing.sm,
  },
  closeButton: {
    width: 56,
    height: 44,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 20, lineHeight: 22, color: colors.textPrimary },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  option: {
    height: 56,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  optionSpacing: { marginTop: spacing.md },
  optionSelected: { backgroundColor: colors.primary },
  optionDefault: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});