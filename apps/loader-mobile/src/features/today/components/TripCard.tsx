import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AlertCallout } from '../../../components/ui/AlertCallout';
import { Chip, type ChipTone } from '../../../components/ui/Chip';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { colors, radius } from '../../../theme/colors';
import type { LoadCategory, LoaderTrip } from '../types';

const CATEGORY: Record<LoadCategory, { label: string; tone: ChipTone }> = {
  fresh: { label: 'Fresh', tone: 'green' },
  style: { label: 'Style', tone: 'violet' },
  tech: { label: 'Tech', tone: 'blue' },
};

/** A trip departing within this many minutes gets the amber warning box. */
const URGENT_MINUTES = 60;

export function formatCountdown(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface TripCardProps {
  trip: LoaderTrip;
  onContinue?: (trip: LoaderTrip) => void;
}

export function TripCard({ trip, onContinue }: TripCardProps) {
  const cat = CATEGORY[trip.category];
  const started = trip.stopsLoaded > 0;
  const progress = trip.totalStops === 0 ? 0 : trip.stopsLoaded / trip.totalStops;
  const urgent = trip.minutesToDeparture <= URGENT_MINUTES;
  const countdown = `Departs in ${formatCountdown(trip.minutesToDeparture)}`;

  return (
    <View style={s.card}>
      <View style={s.headRow}>
        <View style={s.titleBlock}>
          <View style={s.titleRow}>
            <Text style={s.vehicle}>{trip.vehicleCode}</Text>
            <View style={s.tripTag}>
              <Text style={s.tripTagText}>TRIP {trip.tripNo}</Text>
            </View>
          </View>
        </View>

        {urgent ? (
          <View style={s.urgentWrap}>
            <View style={s.urgentBox}>
              <Ionicons name="alarm-outline" size={16} color={colors.amber} />
              <View>
                <Text style={s.urgentLabel}>Departs</Text>
                <Text style={s.urgentTime}>{trip.departsAt}</Text>
              </View>
            </View>
            <Text style={s.urgentCountdown}>{countdown}</Text>
          </View>
        ) : (
          <View style={s.calmWrap}>
            <Text style={s.calmTime}>Departs {trip.departsAt}</Text>
            <Text style={s.calmCountdown}>{countdown}</Text>
          </View>
        )}
      </View>

      <View style={s.chips}>
        <Chip label={cat.label} tone={cat.tone} dot />
        <Chip label={trip.vehicleType} />
        {trip.route ? <Chip label={trip.route} /> : null}
      </View>

      {trip.planUpdate ? (
        <View style={s.gap}>
          <AlertCallout
            title={`Plan Updated (Rev ${trip.planUpdate.revision})`}
            message={trip.planUpdate.message}
          />
        </View>
      ) : null}

      {started ? (
        <>
          <View style={[s.progressBox, s.gap]}>
            <View style={s.progressHead}>
              <View style={s.progressTitle}>
                <View style={s.progressDot} />
                <Text style={s.progressText}>
                  Loading {trip.stopsLoaded} of {trip.totalStops} stops loaded
                </Text>
              </View>
              <Text style={s.percent}>{Math.round(progress * 100)}%</Text>
            </View>
            <ProgressBar value={progress} />
            <View style={s.statsRow}>
              <Text style={s.stat}>
                Payload: <Text style={s.statBold}>{trip.payloadKg.toLocaleString('en-US')} kg</Text>
              </Text>
              <Text style={s.stat}>
                Volume: <Text style={s.statBold}>{trip.volumeM3} m³</Text>
              </Text>
            </View>
          </View>

          <View style={s.gap}>
            <PrimaryButton
              label={`Continue Loading ${trip.vehicleCode}`}
              trailingIcon="arrow-forward"
              onPress={() => onContinue?.(trip)}
            />
          </View>
        </>
      ) : (
        <View style={[s.notStartedRow, s.gap]}>
          <View style={s.notStartedLeft}>
            <View style={s.emptyCircle} />
            <Text style={s.notStartedText}>
              Not started · {trip.stopsLoaded}/{trip.totalStops} stops loaded
            </Text>
          </View>
          <Text style={s.dock}>{trip.dock}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  gap: { marginTop: 14 },

  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  titleBlock: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vehicle: { color: colors.ink, fontSize: 24, fontWeight: '800' },
  tripTag: {
    backgroundColor: '#EEF1F6',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tripTagText: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  urgentWrap: { alignItems: 'center' },
  urgentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberBorder,
  },
  urgentLabel: { color: colors.amber, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  urgentTime: { color: colors.amber, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  urgentCountdown: { color: colors.red, fontSize: 12, fontWeight: '700', marginTop: 4 },

  calmWrap: { alignItems: 'flex-end' },
  calmTime: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  calmCountdown: { color: colors.muted, fontSize: 13, marginTop: 2 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },

  progressBox: {
    backgroundColor: '#F4F7FD',
    borderWidth: 1,
    borderColor: '#E1E8F6',
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
  },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
  progressText: { color: colors.ink, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  percent: { color: colors.blue, fontSize: 15, fontWeight: '800' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { color: colors.muted, fontSize: 13 },
  statBold: { color: colors.ink, fontWeight: '800' },

  notStartedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notStartedLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  emptyCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.muted,
  },
  notStartedText: { color: colors.muted, fontSize: 14 },
  dock: { color: colors.muted, fontSize: 13 },
});