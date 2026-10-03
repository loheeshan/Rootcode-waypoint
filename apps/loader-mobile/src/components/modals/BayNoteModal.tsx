import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  popupColors as colors,
  popupRadius as radius,
  popupSpacing as spacing,
} from '../../theme/popupTokens';

export const DEFAULT_BAY_NOTES = [
  '2 crates damaged in Bay 4',
  '2 crates missing in staging C-12',
  'Load exceeds safe space',
];

type Props = {
  visible: boolean;
  notes?: string[];
  /** Called with the chosen note, or null when the loader picks "No note". */
  onSelect: (note: string | null) => void;
  onClose: () => void;
};

export function BayNoteModal({
  visible,
  notes = DEFAULT_BAY_NOTES,
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
              Add a bay note
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
            Choose a quick note for this demonstration. Notes remain optional.
          </Text>

          {notes.map((note) => (
            <Pressable
              key={note}
              onPress={() => onSelect(note)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.optionText}>{note}</Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => onSelect(null)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.optionText}>No note</Text>
          </Pressable>
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
    marginBottom: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  optionText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  pressed: { opacity: 0.85 },
});