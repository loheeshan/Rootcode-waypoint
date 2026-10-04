import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StatusBanner } from '../../components/ui/StatusBanner';
import { useIsOffline } from '../../hooks/useIsOffline';
import { t } from '../../theme/loaderTokens';
import { DispatchHorizonCard } from './components/DispatchHorizonCard';
import { LockedNotice } from './components/LockedNotice';
import { SessionMismatchCard } from './components/SessionMismatchCard';
import { TripCardView } from './components/TripCardView';
import { trips, type Category } from './trips';

// Flip to true to preview the session-mismatch design.
const SIMULATE_MISMATCH = false;

type Filter = 'All' | Category;
const filters: Filter[] = ['All', 'Fresh', 'Style', 'Tech'];

export default function TodayScreen() {
  const offline = useIsOffline();
  const [mismatch, setMismatch] = useState(SIMULATE_MISMATCH);
  const [filter, setFilter] = useState<Filter>('Fresh');

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { All: trips.length, Fresh: 0, Style: 0, Tech: 0 };
    trips.forEach((trip) => {
      c[trip.category] += 1;
    });
    return c;
  }, []);

  const visible = useMemo(
    () =>
      trips
        .filter((trip) => filter === 'All' || trip.category === filter)
        .sort((a, b) => a.minutes - b.minutes),
    [filter],
  );

  const rightLabel =
    filter === 'All' ? `${trips.length} Pending` : `${visible.length} trip${visible.length === 1 ? '' : 's'}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {offline && (
        <StatusBanner
          title="No connection"
          message="— showing plan last synced at 22:10 (Rev 2). New updates will appear when reconnected."
        />
      )}

      <Text style={styles.title}>Todays Loading</Text>

      {mismatch && (
        <SessionMismatchCard
          staleDepot="Kandy"
          targetDepot="Peliyagoda"
          onSwitch={() => setMismatch(false)} // TODO: real depot switch
          onConfirmRemote={() => setMismatch(false)} // TODO: record remote cover
        />
      )}

      {/* Live plan banner (hidden while the session mismatch is shown) */}
      {!mismatch && (
        <View style={styles.plan}>
          <View style={styles.spread}>
            <View style={styles.row}>
              <View style={styles.liveDot} />
              <Text style={styles.live}>LIVE PLAN</Text>
            </View>
            <Text style={styles.rev}>Rev 2 · 22:10 IST</Text>
          </View>
          <View style={styles.planDivider} />
          <View style={styles.spread}>
            <View>
              <Text style={styles.planLabel}>LOADING FACILITY</Text>
              <Text style={styles.planValue}>Peliyagoda Central Depot</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.planLabel}>ACTIVE DOCK</Text>
              <Text style={styles.planValue}>Bay B-04 / B-08</Text>
            </View>
          </View>
        </View>
      )}

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((f) => {
          const selected = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.pill, selected && styles.pillOn]}
            >
              {selected && f !== 'All' ? <View style={styles.pillDot} /> : null}
              <Text style={styles.pillText}>{f}</Text>
              <View style={[styles.badge, selected && styles.badgeOn]}>
                <Text style={[styles.badgeText, selected && { color: t.text }]}>{counts[f]}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.spread}>
        <View style={styles.row}>
          <Ionicons name="time-outline" size={14} color={t.muted} />
          <Text style={styles.sorted}>Sorted by departure time (next out first)</Text>
        </View>
        <Text style={styles.pending}>{rightLabel}</Text>
      </View>

      {mismatch && <LockedNotice />}

      {/* Trips (locked and dimmed while mismatch is shown) */}
      <View
        pointerEvents={mismatch ? 'none' : 'auto'}
        style={[{ gap: 14 }, mismatch && { opacity: 0.45 }]}
      >
        {visible.map((trip) => (
          <TripCardView key={trip.id} trip={trip} offlineCopy={offline} />
        ))}
        <DispatchHorizonCard count={trips.length} before="05:00 AM" />
      </View>
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
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#60A5FA' },
  pillText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  badgeOn: { backgroundColor: '#fff' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  sorted: { fontSize: 12, color: t.muted },
  pending: { fontSize: 13, fontWeight: '800', color: t.blue },
});