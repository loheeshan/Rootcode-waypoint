import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Notice } from '../../components/ui/ScreenKit';
import { t } from '../../theme/loaderTokens';
import { useLoading } from '../loading/LoadingProvider';
import { TRIP_LABEL, canLoad, colomboTime, shortId } from '../loading/format';

/** Server readiness rules: every order has an outcome and at least one order is loaded. */
export default function DepartScreen() {
  const router = useRouter();
  const { tripId, view, loading, error, busy, refresh, markReady } = useLoading();

  if (!tripId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ready for departure</Text>
        <Notice tone="blue" title="Choose a trip">Select a trip on Today first.</Notice>
        <ActionButton label="Go to Today" onPress={() => router.navigate('/tabs/today')} />
      </ScrollView>
    );
  }
  if (!view) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ready for departure</Text>
        {error ? <Notice tone="red" title="Trip not loaded">{error}</Notice> : <Text style={styles.muted}>Loading trip…</Text>}
        {error ? <ActionButton variant="secondary" label="Try again" onPress={() => void refresh()} /> : null}
      </ScrollView>
    );
  }

  const ready = view.trip.status !== 'PLANNED' && view.trip.status !== 'LOADING';
  const checks: [boolean, string][] = [
    [view.trip.status !== 'PLANNED', 'Loading has started'],
    [view.pending_count === 0, `Every order has an outcome (${view.pending_count} left)`],
    [view.loaded_count > 0, 'At least one order is loaded'],
  ];
  const canMark = canLoad(view.trip.status) && checks.every(([ok]) => ok);
  const exceptions = view.stops.flatMap((stop) =>
    stop.orders.filter((o) => o.load_status === 'MISSING' || o.load_status === 'DAMAGED').map((o) => ({ stop, o })));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
      <Text style={styles.title}>Ready for departure</Text>
      <Text style={styles.muted}>
        Trip {view.trip.trip_number} · Vehicle {shortId(view.trip.vehicle_id)} · departs {colomboTime(view.trip.departure_at)}
      </Text>
      {error ? <Notice tone="red" title="Not marked ready">{error}</Notice> : null}
      {ready ? (
        <Notice tone="green" title={`Trip ${TRIP_LABEL[view.trip.status].toLowerCase()}`}>
          {view.completion
            ? `Confirmed by the server with ${view.completion.loaded_count} loaded, ${view.completion.missing_count} missing and ${view.completion.damaged_count} damaged. The assigned driver can now start the trip.`
            : 'Loading is finalized on the server.'}
        </Notice>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Readiness checks</Text>
        {checks.map(([ok, label]) => (
          <Text key={label} style={[styles.check, { color: ok ? t.green : t.amber }]}>{ok ? '✓' : '•'} {label}</Text>
        ))}
        <Text style={styles.muted}>
          {view.loaded_count} loaded · {view.missing_count} missing · {view.damaged_count} damaged
        </Text>
      </View>

      {exceptions.length ? (
        <Notice tone="amber" title={`${exceptions.length} loading exception${exceptions.length === 1 ? '' : 's'}`}>
          {exceptions.map(({ stop, o }) => `Stop ${stop.sequence_number} · order ${shortId(o.order_id)}: ${o.load_status === 'MISSING' ? 'missing' : 'damaged'} — ${o.note ?? ''}`).join('\n')}
        </Notice>
      ) : null}

      {!ready ? (
        canMark
          ? <ActionButton label={busy ? 'Marking ready…' : 'Mark trip ready'} disabled={busy} onPress={() => void markReady()} />
          : <ActionButton variant="secondary" label="Continue loading" onPress={() => router.navigate('/tabs/checklist')} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: t.text, marginTop: 4 },
  muted: { fontSize: 13, color: t.muted },
  card: { backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 14, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: t.text },
  check: { fontSize: 14, fontWeight: '700' },
});
