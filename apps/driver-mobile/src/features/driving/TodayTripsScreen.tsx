import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ApiError, type DriverTripListResponse, type DriverTripResponse } from '@waypoint/api-contracts';

import { getApiClient } from '../../services/api';
import { colors } from '../../theme/tokens';
import { useDriverTrip } from './DriverTripProvider';
import { TRIP_LABEL, colomboTime, colomboToday, shortId } from './format';
import { Card, DriverScreen, Notice, text } from './ui';

/** Today's trips assigned to the signed-in driver, from GET /driver/trips. */
export function TodayTripsScreen() {
  const router = useRouter();
  const { select, tripId } = useDriverTrip();
  const [trips, setTrips] = useState<DriverTripResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const today = colomboToday();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const page = await getApiClient().request<DriverTripListResponse>(`/driver/trips?delivery_date=${today}&limit=100`);
      setTrips([...page.items].sort((a, b) => a.departure_at.localeCompare(b.departure_at)));
      setError(null);
    } catch (failure) {
      setError(failure instanceof ApiError ? 'Trips could not be loaded. Pull to try again.' : 'No connection. Pull to retry when online.');
    } finally {
      setRefreshing(false);
    }
  }, [today]);

  // Refetch whenever Today is shown so READY/IN_PROGRESS changes from other roles are current.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const open = (trip: DriverTripResponse) => {
    select(trip.trip_id);
    router.navigate('/stops');
  };

  return (
    <DriverScreen title="Today's trips" refreshing={refreshing} onRefresh={load}>
      <Text style={text.muted}>{today} · sorted by departure</Text>
      {error ? <Notice tone="red" title="Trips not loaded">{error}</Notice> : null}
      {trips === null && !error ? <Text style={text.muted}>Loading trips…</Text> : null}
      {trips && !trips.length ? <Notice tone="blue" title="No trips today">No published trips are assigned to you for today.</Notice> : null}
      {trips?.map((trip) => (
        <Pressable key={trip.trip_id} onPress={() => open(trip)} accessibilityRole="button"
          accessibilityLabel={`Trip ${trip.trip_number}, ${TRIP_LABEL[trip.status]}`}>
          <Card selected={trip.trip_id === tripId}>
            <Text style={text.heading}>Trip {trip.trip_number} · Vehicle {shortId(trip.vehicle_id)}</Text>
            <Text style={[text.label, { color: trip.status === 'COMPLETED' ? colors.textMuted : trip.status === 'READY' || trip.status === 'IN_PROGRESS' ? colors.successText : colors.warningText }]}>
              {TRIP_LABEL[trip.status]}
            </Text>
            <Text style={text.muted}>Departs {colomboTime(trip.departure_at)} · returns {colomboTime(trip.return_at)}</Text>
            <Text style={text.muted}>{trip.stop_count} stops · {trip.order_count} orders</Text>
          </Card>
        </Pressable>
      ))}
    </DriverScreen>
  );
}
