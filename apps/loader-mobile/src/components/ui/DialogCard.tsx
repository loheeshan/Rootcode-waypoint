import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { t } from '../../theme/loaderTokens';

export type DialogVariant = 'primary' | 'secondary' | 'danger';
export type DialogButton = { key: string; label: string; variant: DialogVariant };
export type LineTone = 'heading' | 'dark' | 'strong' | 'warn' | 'small';
export type DialogLine = string | { text: string; tone: LineTone };

type Props = {
  visible: boolean;
  title: string;
  body: DialogLine[];
  actions: DialogButton[];
  onAction: (key: string) => void;
  onClose: () => void;
  children?: ReactNode;
};

export function DialogCard({ visible, title, body, actions, onAction, onClose, children }: Props) {
  const { height } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: height * 0.165 }]}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Text style={styles.closeX}>×</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            {body.map((line, i) => {
              const text = typeof line === 'string' ? line : line.text;
              const style = typeof line === 'string' ? styles.muted : tones[line.tone];
              return (
                <Text key={`${i}-${text}`} style={style}>
                  {text}
                </Text>
              );
            })}
          </View>

          {children}

          {actions.length > 0 && (
            <View style={styles.actions}>
              {actions.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={() => onAction(a.key)}
                  style={({ pressed }) => [
                    styles.button,
                    a.variant === 'primary' && styles.primary,
                    a.variant === 'danger' && styles.danger,
                    a.variant === 'secondary' && styles.secondary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.buttonText, a.variant !== 'secondary' && { color: '#fff' }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', paddingHorizontal: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: t.text, lineHeight: 24, paddingTop: 4 },
  close: {
    width: 56, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  closeX: { fontSize: 20, fontWeight: '800', color: t.text, marginTop: -2 },
  body: { gap: 2 },
  muted: { fontSize: 15, lineHeight: 22, color: '#64748B' },
  actions: { gap: 12, marginTop: 4 },
  button: { borderRadius: 12, minHeight: 54, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: t.blue },
  danger: { backgroundColor: '#DC2626' },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1' },
  buttonText: { fontSize: 16, fontWeight: '800', color: t.text, textAlign: 'center' },
});

const tones = StyleSheet.create({
  heading: { fontSize: 17, fontWeight: '800', color: t.text, marginTop: 2 },
  dark: { fontSize: 15, lineHeight: 22, color: '#1E293B', marginTop: 8 },
  strong: { fontSize: 15, fontWeight: '800', color: t.text, marginTop: 6 },
  warn: { fontSize: 12, fontWeight: '800', color: '#C2410C', marginTop: 6 },
  small: { fontSize: 12, fontWeight: '800', color: '#64748B', marginTop: 8 },
});