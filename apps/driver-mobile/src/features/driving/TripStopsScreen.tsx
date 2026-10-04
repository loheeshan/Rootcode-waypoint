import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';
import { useDriverTrip } from './DriverTripProvider';
import { STOP_LABEL, TRIP_LABEL, clock, colomboTime, shortId } from './format';
import { Button, Card, DriverScreen, Notice, text } from './ui';

const STOP_COLOR = { PLANNED: colors.textMuted, ARRIVED: colors.primary, DELIVERED: colors.successText, FAILED: colors.dangerText };

/** Selected trip: start (server READY -> IN_PROGRESS), ordered stops and completion. */
export function TripStopsScreen() {
  const router = useRouter();
  const { tripId, detail, serverStatus, loading, error, busy, refresh, start, complete, attention, discard, offline, fetchedAt } = useDriverTrip();

  if (!tripId) {
    return (
      <DriverScreen title="Stops">
        <Notice tone="blue" title="Choose a trip">Select a trip on Today first.</Notice>
        <Button label="Go to Today" onPress={() => router.navigate('/today')} />
      </DriverScreen>
    );
  }
  if (!detail) {
    return (
      <DriverScreen title="Stops" refreshing={loading} onRefresh={refresh}>
        {error ? <Notice tone="red" title="Trip not loaded">{error}</Notice> : <Text style={text.muted}>Loading trip…</Text>}
        {error ? <Button variant="outline" label="Try again" onPress={() => void refresh()} /> : null}
      </DriverScreen>
    );
  }

  const { trip } = detail;
  const stops = [...detail.stops].sort((a, b) => a.sequence_number - b.sequence_number);
  const required = stops.filter((s) => s.requires_visit);
  const open = required.filter((s) => s.status === 'PLANNED' || s.status === 'ARRIVED');
  const next = open[0];
  const delivered = required.filter((s) => s.status === 'DELIVERED').length;
  const failed = required.filter((s) => s.status === 'FAILED').length;
  // Deliverability is only final once the loader has marked the trip ready.
  const loaded = trip.status !== 'PLANNED' && trip.status !== 'LOADING';
  const subtitle = `Trip ${trip.trip_number} · Vehicle ${shortId(trip.vehicle_id)}`;

  return (
    <DriverScreen title={`Trip ${trip.trip_number}`} subtitle={subtitle} refreshing={loading} onRefresh={refresh}>
      <Text style={text.muted}>
        {TRIP_LABEL[trip.status]}{detail.tripLocal ? ' (waiting to sync)' : ''} · departs {colomboTime(trip.departure_at)} · returns {colomboTime(trip.return_at)}
      </Text>
      {offline ? (
        <Notice tone="amber" title="Offline">Showing the copy saved {fetchedAt ? `at ${colomboTime(fetchedAt)}` : 'on this phone'}.</Notice>
      ) : error ? <Notice tone="red" title="Not saved">{error}</Notice> : null}
      {attention.map((e) => (
        <Card key={e.event_id}>
          <Text style={[text.label, { color: colors.dangerText }]}>Not applied: {e.type.replace('_', ' ').toLowerCase()}</Text>
          <Text style={text.body}>{e.detail ?? e.outcome}</Text>
          <Text style={text.muted}>Later actions for this trip wait. Discard to keep the server's version.</Text>
          <Button variant="outline" label="Discard this change" onPress={() => void discard(e.event_id)} />
        </Card>
      ))}

      {trip.status === 'PLANNED' || trip.status === 'LOADING' ? (
        <Notice tone="amber" title="Waiting for loading">
          The trip can start once the loader marks the vehicle ready. Pull down to check again.
        </Notice>
      ) : null}
      {trip.status === 'READY' && serverStatus === 'READY' ? (
        <Button label="Start trip" loading={busy} onPress={() => void start()} />
      ) : null}
      {trip.status === 'IN_PROGRESS' && detail.started_at ? (
        <Notice tone="blue" title={`Started ${colomboTime(detail.started_at)}`}>
          {open.length ? `${open.length} of ${required.length} stops left.` : 'Every stop has an outcome. Complete the trip.'}
        </Notice>
      ) : null}
      {trip.status === 'COMPLETED' ? (
        <Notice tone="green" title={`Trip completed${detail.completed_at ? ` ${colomboTime(detail.completed_at)}` : ''}`}>
          {delivered} delivered · {failed} not delivered (confirmed by the server).
        </Notice>
      ) : null}

      {stops.map((stop) => (
        <Pressable key={stop.stop_id} accessibilityRole="button"
          accessibilityLabel={`Stop ${stop.sequence_number}, ${stop.outlet_brand}, ${STOP_LABEL[stop.status]}`}
          onPress={() => router.push({ pathname: '/next-stop', params: { stopId: stop.stop_id } } as never)}>
          <Card selected={trip.status === 'IN_PROGRESS' && stop.stop_id === next?.stop_id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={[text.heading, { flex: 1 }]}>{stop.sequence_number}. {stop.outlet_brand}</Text>
              <Text style={[text.label, { color: STOP_COLOR[stop.status], marginTop: 0 }]}>{STOP_LABEL[stop.status]}{stop.local ? ' · waiting to sync' : ''}</Text>
            </View>
            <Text style={text.muted}>
              {stop.outlet_district} · window {clock(stop.window_open_time)}–{clock(stop.window_close_time)}
              {stop.planned_arrival_time ? ` · ETA ${colomboTime(stop.planned_arrival_time)}` : ''}
            </Text>
            <Text style={text.muted}>
              {!loaded
                ? `${stop.orders.length} order${stop.orders.length === 1 ? '' : 's'} · loading not finished`
                : stop.requires_visit
                  ? `${stop.orders.filter((o) => o.deliverable).length} of ${stop.orders.length} orders loaded for delivery`
                  : 'No loaded orders — no visit needed'}
            </Text>
          </Card>
        </Pressable>
      ))}

      {trip.status === 'IN_PROGRESS' && next ? (
        <Button label={`Go to stop ${next.sequence_number}`}
          onPress={() => router.push({ pathname: '/next-stop', params: { stopId: next.stop_id } } as never)} />
      ) : null}
      {trip.status === 'IN_PROGRESS' && !open.length ? (
        <Button label="Complete trip" loading={busy} onPress={() => void complete()} />
      ) : null}
    </DriverScreen>
  );
}
