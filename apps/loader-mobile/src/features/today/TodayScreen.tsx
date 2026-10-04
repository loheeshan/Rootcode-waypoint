import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, type LoaderTripListResponse, type LoaderTripResponse, type TripStatus } from '@waypoint/api-contracts';

import { StatusBanner } from '../../components/ui/StatusBanner';
import { useIsOffline } from '../../hooks/useIsOffline';
import { getApiClient } from '../../services/api';
import { useAuth } from '../../services/auth';
import { SyncBanner } from '../../sync/SyncBanner';
import { useSync } from '../../sync/SyncProvider';
import { readTripList, saveTripList } from '../../sync/store';
import { t } from '../../theme/loaderTokens';
import { useLoading } from '../loading/LoadingProvider';
import { TRIP_LABEL, colomboTime, colomboToday, shortId } from '../loading/format';

type Filter = 'ALL' | 'PLANNED' | 'LOADING' | 'READY';
const FILTERS: [Filter, string][] = [['ALL', 'All'], ['PLANNED', 'Not started'], ['LOADING', 'Loading'], ['READY', 'Ready']];

/** Published trips in the Loader's depots for today, from GET /loader/trips. */
export default function TodayScreen() {
  const router = useRouter();
  const offline = useIsOffline();
  const { user } = useAuth();
  const { select, tripId } = useLoading();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [trips, setTrips] = useState<LoaderTripResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const { db, userId } = useSync();
  const today = colomboToday();

  // Server list first; offline, the copy last saved on this phone for this account and day.
  const load = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    setError(null);
    try {
      const page = await getApiClient().request<LoaderTripListResponse>(`/loader/trips?delivery_date=${today}&limit=100`);
      await saveTripList(db, userId, today, page.items);
      setTrips(page.items);
      setCachedAt(null);
    } catch (failure) {
      const cached = await readTripList(db, userId, today);
      if (cached) {
        setTrips(cached.value);
        setCachedAt(cached.fetchedAt);
      }
      setError(failure instanceof ApiError ? 'Trips could not be refreshed. Pull to try again.' : null);
    } finally {
      setRefreshing(false);
    }
  }, [today, db, userId]);

  // Refetch whenever Today is shown so statuses changed on other tabs (e.g. READY) are current.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visible = useMemo(
    () => (trips ?? [])
      .filter((trip) => filter === 'ALL' || trip.status === filter)
      .sort((a, b) => a.departure_at.localeCompare(b.departure_at)),
    [trips, filter],
  );
  const count = (f: Filter) => (trips ?? []).filter((trip) => f === 'ALL' || trip.status === f).length;

  const open = (trip: LoaderTripResponse) => {
    select(trip.trip_id);
    router.navigate('/tabs/checklist');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      {offline && <StatusBanner title="No connection" message={cachedAt ? `— showing trips saved at ${colomboTime(cachedAt)}.` : trips ? '— showing trips saved on this phone.' : '— no trips saved on this phone yet.'} />}
      <Text style={styles.title}>Today's loading</Text>
      <SyncBanner />

      <View style={styles.plan}>
        <View style={styles.spread}>
          <View style={styles.row}>
            <View style={styles.liveDot} />
            <Text style={styles.live}>PUBLISHED PLAN</Text>
          </View>
          <Text style={styles.rev}>{today}</Text>
        </View>
        <View style={styles.planDivider} />
        <View style={styles.spread}>
          <View>
            <Text style={styles.planLabel}>DEPOTS</Text>
            <Text style={styles.planValue}>{user?.depot_ids.map(shortId).join(', ') || '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.planLabel}>TRIPS TODAY</Text>
            <Text style={styles.planValue}>{trips ? trips.length : '…'}</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map(([key, label]) => (
          <Pressable key={key} onPress={() => setFilter(key)} style={[styles.pill, filter === key && styles.pillOn]}
            accessibilityRole="button" accessibilityState={{ selected: filter === key }}>
            <Text style={styles.pillText}>{label}</Text>
            <View style={[styles.badge, filter === key && styles.badgeOn]}>
              <Text style={[styles.badgeText, filter === key && { color: t.text }]}>{count(key)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.row}>
        <Ionicons name="time-outline" size={14} color={t.muted} />
        <Text style={styles.sorted}>Sorted by departure time (next out first)</Text>
      </View>

      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {trips === null && !error ? <Text style={styles.sorted}>Loading trips…</Text> : null}
      {trips && !visible.length ? (
        <View style={styles.card}><Text style={styles.cardTitle}>No trips</Text>
          <Text style={styles.cardLine}>No published trips match this filter for today.</Text></View>
      ) : null}

      {visible.map((trip) => (
        <Pressable key={trip.trip_id} onPress={() => open(trip)} accessibilityRole="button"
          style={[styles.card, trip.trip_id === tripId && styles.cardSelected]}>
          <View style={styles.spread}>
            <Text style={styles.cardTitle}>Trip {trip.trip_number} · Vehicle {shortId(trip.vehicle_id)}</Text>
            <Text style={[styles.status, trip.status === 'READY' && { color: t.green }]}>{TRIP_LABEL[trip.status as TripStatus]}</Text>
          </View>
          <Text style={styles.cardLine}>Departs {colomboTime(trip.departure_at)} · returns {colomboTime(trip.return_at)}</Text>
          <Text style={styles.cardLine}>{trip.stop_count} stops · {trip.order_count} orders · driver {trip.driver_id ? 'assigned' : 'not assigned'}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: t.text, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  plan: { backgroundColor: t.navy, borderRadius: 18, padding: 16 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  live: { fontSize: 12, fontWeight: '800', color: '#34D399', letterSpacing: 0.6 },
  rev: { fontSize: 12, color: '#94A3B8' },
  planDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 14 },
  planLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6 },
  planValue: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 4 },
  filters: { gap: 8, paddingRight: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0B0F1A', borderRadius: 999, borderWidth: 2, borderColor: '#0B0F1A',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  pillOn: { borderColor: t.blue },
  pillText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  badgeOn: { backgroundColor: '#fff' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  sorted: { fontSize: 12, color: t.muted },
  error: { fontSize: 14, color: t.red, fontWeight: '600' },
  card: { backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 14, gap: 4 },
  cardSelected: { borderColor: t.blue, borderWidth: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: t.text },
  cardLine: { fontSize: 13, color: t.muted },
  status: { fontSize: 12, fontWeight: '800', color: t.blue },
});
