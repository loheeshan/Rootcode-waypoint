import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../components/ui/Card';
import { t } from '../../../theme/loaderTokens';

type Props = { count: number; before: string };

export function DispatchHorizonCard({ count, before }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="bus-outline" size={22} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Shift Dispatch Horizon</Text>
        <Text style={styles.sub}>
          {count} departures scheduled before {before}
        </Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeNum}>{count}</Text>
        <Text style={styles.badgeLabel}>Trucks</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: t.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800', color: t.text },
  sub: { fontSize: 12, color: t.muted, marginTop: 2, lineHeight: 17 },
  badge: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    backgroundColor: t.blueBg, borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  badgeNum: { fontSize: 20, fontWeight: '800', color: t.blue },
  badgeLabel: { fontSize: 12, fontWeight: '700', color: t.text },
});