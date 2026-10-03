import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';

export const DEFAULT_DRIVER_NOTES = [
  'Shutter closed; gate locked',
  'Receiver unavailable at dock',
  'Vehicle access is blocked',
];

type Props = {
  visible: boolean;
  notes?: string[];
  /** The currently highlighted note (shown in blue). */
  selectedNote: string;
  onSelect: (note: string) => void;
  onClose: () => void;
};

export function QuickDriverNoteModal({
  visible,
  notes = DEFAULT_DRIVER_NOTES,
  selectedNote,
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
              Quick driver note
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
            Choose a short note for the failed delivery record.
          </Text>

          {notes.map((note, index) => {
            const selected = note === selectedNote;
            return (
              <Pressable
                key={note}
                onPress={() => onSelect(note)}
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
                  {note}
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