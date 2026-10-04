import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { colors } from '../../theme/tokens';
import { useDriverTrip } from './DriverTripProvider';
import { FAILURE_LABEL, clock, colomboTime, shortId } from './format';
import { PodPhoto } from './PodPhoto';
import { Button, Card, DriverScreen, Notice, text } from './ui';

/** One stop: arrive, then record proof of delivery or a failed delivery. */
export function StopScreen() {
  const router = useRouter();
  const { stopId } = useLocalSearchParams<{ stopId?: string }>();
  const { tripId, detail, loading, error, busy, refresh, clearError, arrive } = useDriverTrip();
  // An error from another stop does not belong on this one.
  useEffect(() => { clearError(); }, [stopId, clearError]);
  const stop = detail?.stops.find((s) => s.stop_id === stopId);

  if (!tripId || !detail || !stop) {
    return (
      <DriverScreen title="Stop" refreshing={loading} onRefresh={refresh}>
        {error ? <Notice tone="red" title="Stop not loaded">{error}</Notice> : null}
        {!error && loading ? <Text style={text.muted}>Loading stop…</Text> : null}
        {!loading && !error ? <Notice tone="blue" title="Choose a stop">Open a stop from your trip.</Notice> : null}
        <Button variant="outline" label="Back to stops" onPress={() => router.navigate('/stops')} />
      </DriverScreen>
    );
  }

  const status = detail.trip.status;
  const onRoute = status === 'IN_PROGRESS';
  const deliverable = stop.orders.filter((o) => o.deliverable);
  const goTo = (pathname: string) => router.push({ pathname, params: { stopId: stop.stop_id } } as never);

  return (
    <DriverScreen title={`Stop ${stop.sequence_number} · ${stop.outlet_brand}`}
      subtitle={`Trip ${detail.trip.trip_number} · Vehicle ${shortId(detail.trip.vehicle_id)}`}
      refreshing={loading} onRefresh={refresh}>
      <Text style={text.muted}>
        {stop.outlet_district} · window {clock(stop.window_open_time)}–{clock(stop.window_close_time)}
        {stop.planned_arrival_time ? ` · ETA ${colomboTime(stop.planned_arrival_time)}` : ''}
      </Text>
      {error ? <Notice tone="red" title="Not saved">{error}</Notice> : null}

      {stop.status === 'DELIVERED' ? (
        <Notice tone="green" title={`Delivered${stop.outcome_at ? ` ${colomboTime(stop.outcome_at)}` : ''}`}>
          Confirmed by the server for {deliverable.length} order{deliverable.length === 1 ? '' : 's'}.
        </Notice>
      ) : null}
      {stop.status === 'FAILED' ? (
        <Notice tone="red" title={`Not delivered${stop.outcome_at ? ` · ${colomboTime(stop.outcome_at)}` : ''}`}>
          {stop.failure_reason ? FAILURE_LABEL[stop.failure_reason] : 'Failed'}{stop.failure_note ? ` — ${stop.failure_note}` : ''}
        </Notice>
      ) : null}
      {stop.status === 'ARRIVED' && stop.arrived_at ? (
        <Notice tone="blue" title={`Arrived ${colomboTime(stop.arrived_at)}`}>Record proof of delivery, or report why it could not be delivered.</Notice>
      ) : null}
      {!stop.requires_visit && status !== 'PLANNED' && status !== 'LOADING' ? <Notice tone="amber" title="No visit needed">No orders for this stop were loaded on the vehicle.</Notice> : null}
      {stop.status === 'PLANNED' && stop.requires_visit && !onRoute ? (
        <Notice tone="amber" title="Trip not started">
          {status === 'COMPLETED' ? 'This trip is completed.' : 'Start the trip from Stops before arriving.'}
        </Notice>
      ) : null}

      <Card>
        <Text style={text.heading}>Orders</Text>
        {stop.orders.map((order) => (
          <View key={order.order_id} style={{ paddingTop: 6 }}>
            <Text style={text.body}>
              Order {shortId(order.order_id)} · {order.temperature_requirement === 'chilled' ? 'Chilled' : 'Ambient'} · {order.order_weight_kg} kg · {order.order_volume_m3} m³
            </Text>
            <Text style={[text.muted, { color: status === 'PLANNED' || status === 'LOADING' ? colors.textMuted : order.deliverable ? colors.successText : colors.dangerText }]}>
              {status === 'PLANNED' || status === 'LOADING' ? 'Loading not finished' : order.deliverable ? 'Loaded — deliver at this stop' : `Not loaded (${order.load_status === 'DAMAGED' ? 'damaged' : order.load_status === 'MISSING' ? 'missing' : 'not checked'}) — do not deliver`}
            </Text>
          </View>
        ))}
      </Card>

      {stop.pod && stop.status !== 'FAILED' ? <Card><PodPhoto tripId={tripId} pod={stop.pod} /></Card> : null}

      {onRoute && stop.requires_visit && stop.status === 'PLANNED' ? (
        <Button label="I've arrived" loading={busy} onPress={() => void arrive(stop.stop_id)} />
      ) : null}
      {onRoute && stop.status === 'ARRIVED' ? (
        <Button label={stop.pod ? 'Confirm delivery' : 'Record proof of delivery'} disabled={busy} onPress={() => goTo('/record-delivery')} />
      ) : null}
      {onRoute && stop.requires_visit && (stop.status === 'PLANNED' || stop.status === 'ARRIVED') ? (
        <Button variant="danger" label="Could not deliver" disabled={busy} onPress={() => goTo('/could-not-deliver')} />
      ) : null}
      <Button variant="outline" label="Back to stops" onPress={() => router.navigate('/stops')} />
    </DriverScreen>
  );
}
