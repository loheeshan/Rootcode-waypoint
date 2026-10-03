// src/features/today/components/SessionMismatchCard.tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Pill } from '../../../components/ui/Pill';
import { t } from '../../../theme/loaderTokens';

type Props = {
  staleDepot: string; // e.g. 'Kandy'
  targetDepot: string; // e.g. 'Peliyagoda'
  onSwitch: () => void;
  onConfirmRemote: () => void;
};

export function SessionMismatchCard({ staleDepot, targetDepot, onSwitch, onConfirmRemote }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.spread}>
        <Pill label="SESSION MISMATCH" tone="amber" icon="warning" />
        <Text style={styles.active}>Active: {staleDepot} Hub</Text>
      </View>

      <Text style={styles.headline}>
        Session mismatch — this device was last signed in for {staleDepot} Depot.
      </Text>
      <Text style={styles.body}>
        Switch to {targetDepot} to see today's trips, or confirm you're covering this shift remotely.
      </Text>

      <Pressable style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]} onPress={onSwitch}>
        <Ionicons name="swap-horizontal" size={18} color="#fff" />
        <Text style={styles.primaryText}>Switch to {targetDepot} Depot</Text>
      </Pressable>

      <Pressable style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]} onPress={onConfirmRemote}>
        <Text style={styles.secondaryText}>This is correct — I'm covering {staleDepot} remotely</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#F5C542',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  active: { fontSize: 12, fontWeight: '700', color: t.amber },
  headline: { fontSize: 17, fontWeight: '800', color: '#78350F', lineHeight: 23 },
  body: { fontSize: 14, color: '#92400E', lineHeight: 20 },
  primary: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.blue, borderRadius: 12, paddingVertical: 14, marginTop: 4,
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondary: {
    alignItems: 'center', backgroundColor: '#fff', borderWidth: 1,
    borderColor: '#F5C542', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12,
  },
  secondaryText: { fontSize: 13, fontWeight: '700', color: '#92400E', textAlign: 'center' },
});