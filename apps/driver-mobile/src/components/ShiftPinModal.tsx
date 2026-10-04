import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';

type Props = {
  visible: boolean;
  /** Hint line under the title, e.g. "Use the sample shift PIN 8829." */
  hint: string;
  pinLength?: number;
  onSubmit: (pin: string) => void;
  onClose: () => void;
};

type Key = { label: string; action: 'digit' | 'clear' | 'done'; value?: string };

const KEYS: Key[] = [
  { label: '1', action: 'digit', value: '1' },
  { label: '2', action: 'digit', value: '2' },
  { label: '3', action: 'digit', value: '3' },
  { label: '4', action: 'digit', value: '4' },
  { label: '5', action: 'digit', value: '5' },
  { label: '6', action: 'digit', value: '6' },
  { label: '7', action: 'digit', value: '7' },
  { label: '8', action: 'digit', value: '8' },
  { label: '9', action: 'digit', value: '9' },
  { label: 'Clear', action: 'clear' },
  { label: '0', action: 'digit', value: '0' },
  { label: 'Done', action: 'done' },
];

export function ShiftPinModal({ visible, hint, pinLength = 4, onSubmit, onClose }: Props) {
  const [pin, setPin] = useState('');

  // Start with an empty PIN every time the popup opens.
  useEffect(() => {
    if (visible) setPin('');
  }, [visible]);

  const handleKey = (key: Key) => {
    if (key.action === 'digit' && key.value) {
      setPin((p) => (p.length < pinLength ? p + key.value : p));
    } else if (key.action === 'clear') {
      setPin('');
    } else if (key.action === 'done') {
      if (pin.length === pinLength) onSubmit(pin);
    }
  };

  const rows = [KEYS.slice(0, 3), KEYS.slice(3, 6), KEYS.slice(6, 9), KEYS.slice(9, 12)];

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
              Enter shift PIN
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

          <Text style={styles.hint}>{hint}</Text>

          <View
            style={styles.dots}
            accessibilityLabel={`${pin.length} of ${pinLength} digits entered`}
          >
            {Array.from({ length: pinLength }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < pin.length ? styles.dotFilled : styles.dotEmpty]}
              />
            ))}
          </View>

          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.row, rowIndex > 0 && styles.rowSpacing]}>
              {row.map((key) => (
                <Pressable
                  key={key.label}
                  onPress={() => handleKey(key)}
                  style={({ pressed }) => [styles.key, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={key.label}
                >
                  <Text style={styles.keyText}>{key.label}</Text>
                </Pressable>
              ))}
            </View>
          ))}
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
  hint: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    height: 24,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dot: { width: 11, height: 11, borderRadius: 6, marginRight: 6 },
  dotFilled: { backgroundColor: colors.textPrimary },
  dotEmpty: { backgroundColor: colors.border },
  row: { flexDirection: 'row' },
  rowSpacing: { marginTop: spacing.md },
  key: {
    flex: 1,
    height: 56,
    marginHorizontal: 4,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  pressed: { opacity: 0.7, backgroundColor: colors.background },
});