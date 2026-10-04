import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme/colors';

export interface ModalAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
}

interface AppModalProps {
  visible: boolean;
  title: string;
  body: string;
  actions: ModalAction[];
  onClose: () => void;
}

export function AppModal({ visible, title, body, actions, onClose }: AppModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            {actions.map((action, index) => (
              <Pressable
                key={index}
                onPress={action.onPress}
                style={[
                  styles.actionBase,
                  action.variant === 'danger' && styles.actionDanger,
                  action.variant === 'outline' && styles.actionOutline,
                  (!action.variant || action.variant === 'primary') && styles.actionPrimary,
                ]}
              >
                <Text style={[styles.actionText, action.variant === 'outline' ? styles.actionTextDark : styles.actionTextLight]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(100,100,110,0.55)', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 110 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, width: '88%', padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700', color: '#101828', flex: 1, paddingRight: spacing.md },
  closeButton: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: '#E4E7EC', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, color: '#475467' },
  body: { marginTop: spacing.sm, fontSize: 14, color: '#475467', lineHeight: 20 },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  actionBase: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  actionPrimary: { backgroundColor: colors.primary },
  actionDanger: { backgroundColor: colors.danger },
  actionOutline: { borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: 'transparent' },
  actionText: { fontSize: 15, fontWeight: '600' },
  actionTextLight: { color: colors.white },
  actionTextDark: { color: '#344054' },
});