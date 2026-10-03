import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { FilterTabs, type FilterOption } from './components/FilterTabs';
import { PlanBanner } from './components/PlanBanner';
import { TripCard } from './components/TripCard';
import { livePlan, trips } from './mockData';
import type { TripFilter } from './types';

export function TodayScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<TripFilter>('all');

  const sorted = useMemo(
    () => [...trips].sort((a, b) => a.minutesToDeparture - b.minutesToDeparture),
    []
  );

  const options: FilterOption<TripFilter>[] = useMemo(
    () => [
      { key: 'all', label: 'All', count: sorted.length },
      { key: 'fresh', label: 'Fresh', count: sorted.filter((t) => t.category === 'fresh').length },
      { key: 'style', label: 'Style', count: sorted.filter((t) => t.category === 'style').length },
      { key: 'tech', label: 'Tech', count: sorted.filter((t) => t.category === 'tech').length },
    ],
    [sorted]
  );

  const visible = filter === 'all' ? sorted : sorted.filter((t) => t.category === filter);
  const pending = visible.filter((t) => t.stopsLoaded < t.totalStops).length;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>Todays Loading</Text>

      <PlanBanner plan={livePlan} />

      <View style={s.filters}>
        <FilterTabs options={options} value={filter} onChange={setFilter} />
      </View>

      <View style={s.sortRow}>
        <View style={s.sortLeft}>
          <Ionicons name="time-outline" size={16} color={colors.muted} />
          <Text style={s.sortText}>Sorted by departure time (next out first)</Text>
        </View>
        <Text style={s.pending}>{pending} Pending</Text>
      </View>

      <View style={s.list}>
        {visible.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            onContinue={() => router.push('/checklist')}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginBottom: 14 },
  filters: { marginTop: 16 },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  sortLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  sortText: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  pending: { color: colors.blue, fontSize: 14, fontWeight: '800' },
  list: { marginTop: 12, gap: 14 },
});