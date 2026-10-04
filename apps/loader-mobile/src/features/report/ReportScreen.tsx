import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, Notice } from '../../components/ui/ScreenKit';
import { t } from '../../theme/loaderTokens';
import { useLoading } from '../loading/LoadingProvider';
import { LOAD_LABEL, canLoad, shortId } from '../loading/format';

type Problem = 'MISSING' | 'DAMAGED';

/** Record a missing or damaged whole order with the required explanation. */
export default function ReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const { tripId, view, error, busy, record, refresh } = useLoading();
  const [orderId, setOrderId] = useState<string | null>(params.orderId ?? null);
  const [problem, setProblem] = useState<Problem>('MISSING');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  useEffect(() => { if (params.orderId) setOrderId(params.orderId); }, [params.orderId]);
  // Drop a selection that is not on the current trip (e.g. after switching trips).
  useEffect(() => {
    if (view && orderId && !view.stops.some((s) => s.orders.some((o) => o.order_id === orderId))) setOrderId(null);
  }, [view, orderId]);

  if (!tripId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Report a problem</Text>
        <Notice tone="blue" title="Choose a trip">Select a trip on Today first.</Notice>
        <ActionButton label="Go to Today" onPress={() => router.navigate('/tabs/today')} />
      </ScrollView>
    );
  }
  if (!view) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Report a problem</Text>
        {error ? <Notice tone="red" title="Trip not loaded">{error}</Notice> : <Text style={styles.muted}>Loading trip…</Text>}
        {error ? <ActionButton variant="secondary" label="Try again" onPress={() => void refresh()} /> : null}
      </ScrollView>
    );
  }

  const orders = view.stops.flatMap((stop) => stop.orders.map((order) => ({ stop, order })));
  const editable = canLoad(view.trip.status);

  const submit = async () => {
    setSaved(null);
    if (!orderId) return setInvalid('Choose the order with the problem.');
    if (!note.trim()) return setInvalid('Describe what is missing or damaged.');
    if (note.length > 500) return setInvalid('Keep the note to 500 characters.');
    setInvalid(null);
    if (await record(orderId, problem, note.trim())) {
      setSaved(`Order ${shortId(orderId)} recorded as ${LOAD_LABEL[problem].toLowerCase()}.`);
      setNote('');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Report a problem</Text>
      {!editable ? <Notice tone="green" title="Loading finalized">Problems can only be recorded before the trip is ready.</Notice> : null}
      {saved ? <Notice tone="green" title="Saved">{saved} The dispatcher sees it as a loading exception.</Notice> : null}
      {error ? <Notice tone="red" title="Not saved">{error}</Notice> : null}
      {invalid ? <Notice tone="amber" title="Check the report">{invalid}</Notice> : null}

      <Text style={styles.label}>Order</Text>
      {orders.map(({ stop, order }) => (
        <Pressable
          key={order.order_id}
          onPress={() => setOrderId(order.order_id)}
          accessibilityRole="radio"
          accessibilityState={{ selected: orderId === order.order_id }}
          style={[styles.option, orderId === order.order_id && styles.optionOn]}
        >
          <Text style={styles.optionTitle}>Order {shortId(order.order_id)} · stop {stop.sequence_number}</Text>
          <Text style={styles.muted}>
            {order.order_weight_kg} kg · {order.order_volume_m3} m³ · {order.load_status ? LOAD_LABEL[order.load_status] : 'not checked'}
          </Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Problem</Text>
      <View style={styles.row}>
        {(['MISSING', 'DAMAGED'] as const).map((key) => (
          <Pressable key={key} onPress={() => setProblem(key)} accessibilityRole="radio"
            accessibilityState={{ selected: problem === key }}
            style={[styles.option, styles.half, problem === key && styles.optionOn]}>
            <Text style={styles.optionTitle}>{LOAD_LABEL[key]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Note (required)</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Not staged in bay; carton crushed"
        multiline
        maxLength={500}
        accessibilityLabel="Problem note"
      />
      {editable ? <ActionButton label={busy ? 'Saving…' : 'Record problem'} disabled={busy} onPress={() => void submit()} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: t.text, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '700', color: t.text, marginTop: 6 },
  muted: { fontSize: 13, color: t.muted },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  option: { backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.border, padding: 12 },
  optionOn: { borderColor: t.blue, borderWidth: 2 },
  optionTitle: { fontSize: 14, fontWeight: '700', color: t.text },
  input: {
    backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 12,
    padding: 12, minHeight: 80, fontSize: 15, color: t.text, textAlignVertical: 'top',
  },
});
