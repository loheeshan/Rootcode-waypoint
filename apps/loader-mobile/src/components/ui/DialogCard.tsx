import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { t } from '../../theme/loaderTokens';

export type DialogVariant = 'primary' | 'secondary' | 'danger';
export type DialogButton = { key: string; label: string; variant: DialogVariant };

type Props = {
  visible: boolean;
  title: string;
  body: string[];
  actions: DialogButton[];
  onAction: (key: string) => void;
  onClose: () => void;
};

export function DialogCard({ visible, title, body, actions, onAction, onClose }: Props) {
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
            {body.map((line) => (
              <Text key={line} style={styles.bodyText}>
                {line}
              </Text>
            ))}
          </View>

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
  bodyText: { fontSize: 15, lineHeight: 22, color: '#64748B' },
  actions: { gap: 12, marginTop: 4 },
  button: { borderRadius: 12, minHeight: 54, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: t.blue },
  danger: { backgroundColor: '#DC2626' },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1' },
  buttonText: { fontSize: 16, fontWeight: '800', color: t.text, textAlign: 'center' },
});