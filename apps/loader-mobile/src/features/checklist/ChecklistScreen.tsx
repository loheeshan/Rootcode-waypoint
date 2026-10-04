import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Notice } from '../../components/ui/ScreenKit';
import { t } from '../../theme/loaderTokens';
import { useLoading } from '../loading/LoadingProvider';
import { LOAD_LABEL, TRIP_LABEL, canLoad, colomboTime, shortId } from '../loading/format';

/** Stop-sequenced manifest for the selected trip; each whole order is marked once loaded. */
export default function ChecklistScreen() {
  const router = useRouter();
  const { tripId, view, loading, error, busy, refresh, record } = useLoading();

  if (!tripId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Loading checklist</Text>
        <Notice tone="blue" title="Choose a trip">Select a trip on Today to see its loading checklist.</Notice>
        <ActionButton label="Go to Today" onPress={() => router.navigate('/tabs/today')} />
      </ScrollView>
    );
  }

  const editable = view ? canLoad(view.trip.status) : false;
  // Load the last stop first so the first delivery is nearest the door.
  const stops = view ? [...view.stops].sort((a, b) => b.sequence_number - a.sequence_number) : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <Text style={styles.title}>Loading checklist</Text>
      {error ? <Notice tone="red" title="Not saved">{error}</Notice> : null}
      {!view && loading ? <Text style={styles.muted}>Loading trip…</Text> : null}
      {view ? (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>
              Trip {view.trip.trip_number} · Vehicle {shortId(view.trip.vehicle_id)}
            </Text>
            <Text style={styles.summaryLine}>
              {TRIP_LABEL[view.trip.status]} · departs {colomboTime(view.trip.departure_at)}
            </Text>
            <Text style={styles.summaryLine}>
              {view.loaded_count} loaded · {view.missing_count} missing · {view.damaged_count} damaged · {view.pending_count} to check
            </Text>
          </View>
          {!editable ? (
            <Notice tone="green" title="Loading finalized">This trip is {TRIP_LABEL[view.trip.status].toLowerCase()}; loading can no longer change.</Notice>
          ) : null}
          <Text style={styles.muted}>Load order: last stop first (deepest in the vehicle)</Text>
          {stops.map((stop) => (
            <View key={stop.stop_id} style={styles.stop}>
              <Text style={styles.stopTitle}>Stop {stop.sequence_number} · Outlet {shortId(stop.outlet_id)}</Text>
              {stop.orders.map((order) => (
                <View key={order.order_id} style={styles.order}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderTitle}>
                      Order {shortId(order.order_id)} · {order.temperature_requirement === 'chilled' ? 'Chilled' : 'Ambient'}
                    </Text>
                    <Text style={styles.muted}>{order.order_weight_kg} kg · {order.order_volume_m3} m³</Text>
                    <Text style={[styles.state, { color: !order.load_status ? t.muted : order.load_status === 'LOADED' ? t.green : t.red }]}>
                      {order.load_status ? LOAD_LABEL[order.load_status] : 'Not checked'}
                      {order.note ? ` · ${order.note}` : ''}
                    </Text>
                  </View>
                  {editable ? (
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mark order ${shortId(order.order_id)} loaded`}
                        disabled={busy || order.load_status === 'LOADED'}
                        onPress={() => void record(order.order_id, 'LOADED')}
                        style={[styles.btn, styles.btnPrimary, (busy || order.load_status === 'LOADED') && styles.btnOff]}
                      >
                        <Text style={styles.btnPrimaryText}>Loaded</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Report a problem with order ${shortId(order.order_id)}`}
                        disabled={busy}
                        onPress={() => router.navigate({ pathname: '/tabs/report', params: { orderId: order.order_id } } as never)}
                        style={[styles.btn, busy && styles.btnOff]}
                      >
                        <Text style={styles.btnText}>Problem</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
          {editable ? <ActionButton label="Review and mark ready" onPress={() => router.navigate('/tabs/depart')} /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: t.text, marginTop: 4 },
  muted: { fontSize: 13, color: t.muted },
  summary: { backgroundColor: t.navy, borderRadius: 16, padding: 14, gap: 4 },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  summaryLine: { fontSize: 13, color: '#CBD5E1' },
  stop: { backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 12, gap: 10 },
  stopTitle: { fontSize: 15, fontWeight: '800', color: t.text },
  order: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10 },
  orderTitle: { fontSize: 14, fontWeight: '700', color: t.text },
  state: { fontSize: 13, fontWeight: '700', color: t.green, marginTop: 2 },
  actions: { gap: 6 },
  btn: { borderRadius: 10, borderWidth: 1, borderColor: t.border, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  btnPrimary: { backgroundColor: t.blue, borderColor: t.blue },
  btnOff: { opacity: 0.45 },
  btnText: { fontSize: 13, fontWeight: '700', color: t.text },
  btnPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
