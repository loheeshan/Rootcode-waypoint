import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';

type Props = {
  visible: boolean;
  title: string;
  message: React.ReactNode;
  buttonLabel: string;
  /** Called by the button, the × button and the Android back button. */
  onDismiss: () => void;
};

/**
 * Shared single-button popup: title + close button, muted message, one primary button.
 * Use ConfirmModal when the popup needs a second (cancel) button.
 */
export function NoticeModal({ visible, title, message, buttonLabel, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              onPress={onDismiss}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.body}>{message}</Text>

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{buttonLabel}</Text>
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
  primaryButton: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.primaryText },
  pressed: { opacity: 0.85 },
});