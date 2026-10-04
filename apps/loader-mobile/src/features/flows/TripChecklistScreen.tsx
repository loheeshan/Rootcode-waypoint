import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ActionButton, InfoCard, Notice, Screen } from '../../components/ui/ScreenKit';
import { t } from '../../theme/loaderTokens';
import { useDialog } from '../dialogs/DialogProvider';

const trip2Orders = [
  { load: 1, stop: 6, title: 'OUT096 · Colombo Fresh' },
  { load: 2, stop: 5, title: 'OUT095 · Colombo Fresh' },
  { load: 3, stop: 4, title: 'OUT044 · reassigned order' },
  { load: 4, stop: 3, title: 'OUT088 · Colombo Fresh' },
  { load: 5, stop: 2, title: 'OUT087 · Colombo Fresh' },
  { load: 6, stop: 1, title: 'OUT086 · Colombo Fresh' },
];

export default function TripChecklistScreen() {
  const { openDialog } = useDialog();
  const [done, setDone] = useState<boolean[]>(trip2Orders.map(() => false));
  const count = done.filter(Boolean).length;
  const toggle = (i: number) => setDone((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const finish = () => openDialog(count < trip2Orders.length ? 'completeSixLines' : 'trip2Complete');

  return (
    <Screen title="VEH022 · Trip 2">
      <Notice tone="amber" title="Updated · Plan rev 3">
        ORD0092350 / OUT044 was reassigned from VEH018. Verify the staging unit before loading.
      </Notice>
      <InfoCard
        title="Fresh · Chilled van"
        lines={['Bay B-07 · departure 04:15', '6 delivery stops · load last stop first']}
      />
      <Text style={styles.count}>
        {count} of {trip2Orders.length} orders loaded
      </Text>

      {trip2Orders.map((o, i) => (
        <Pressable key={o.title} onPress={() => toggle(i)} style={[styles.order, done[i] && styles.orderDone]}>
          <Text style={styles.orderLabel}>
            LOAD {o.load} · STOP {o.stop}
          </Text>
          <Text style={styles.orderTitle}>{o.title}</Text>
          <Text style={styles.orderNote}>Chilled cartons · verify manifest</Text>
          <Text style={[styles.orderAction, done[i] && { color: t.green }]}>
            {done[i] ? '✓ Loaded · tap to undo' : 'Tap to confirm loaded'}
          </Text>
        </Pressable>
      ))}

      <ActionButton label="Finish loading VEH022" onPress={finish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 16, fontWeight: '800', color: t.blue },
  order: {
    backgroundColor: '#EFF4FF', borderWidth: 1.5, borderColor: t.blue,
    borderRadius: 16, padding: 16, gap: 4,
  },
  orderDone: { backgroundColor: t.greenSoft, borderColor: '#86EFAC' },
  orderLabel: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 0.4 },
  orderTitle: { fontSize: 18, fontWeight: '800', color: t.text, marginTop: 2 },
  orderNote: { fontSize: 14, color: '#64748B' },
  orderAction: { fontSize: 14, fontWeight: '800', color: t.blue, marginTop: 6 },
});