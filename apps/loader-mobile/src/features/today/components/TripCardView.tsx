import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../components/ui/Card';
import { Pill } from '../../../components/ui/Pill';
import { t } from '../../../theme/loaderTokens';
import type { Trip } from '../trips';

type Props = { trip: Trip; offlineCopy?: boolean };

export function TripCardView({ trip, offlineCopy }: Props) {
  const router = useRouter();
  const go = (pathname: string, params?: Record<string, string>) =>
    router.navigate((params ? { pathname, params } : pathname) as never);
  const s = trip.status;

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.top}>
        <View style={styles.idRow}>
          <Text style={styles.id}>{trip.id}</Text>
          <Pill label={`TRIP ${trip.trip}`} tone="neutral" />
        </View>

        {trip.urgent ? (
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={styles.urgentBox}>
              <Ionicons name="alarm-outline" size={16} color={t.amber} />
              <View>
                <Text style={styles.urgentLabel}>Departs</Text>
                <Text style={styles.urgentTime}>{trip.departs}</Text>
              </View>
            </View>
            <Text style={styles.urgentIn}>Departs in {trip.departsIn}</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.departs}>Departs {trip.departs}</Text>
            <Text style={styles.departsIn}>Departs in {trip.departsIn}</Text>
          </View>
        )}
      </View>

      {/* Tags */}
      <View style={styles.tagsRow}>
        <View style={styles.tags}>
          {trip.category === 'Fresh' ? (
            <Pill label="Fresh" tone="green" icon="ellipse" />
          ) : (
            <Pill label={trip.category} tone="neutral" />
          )}
          {trip.tags.map((tag: string) => (
            <Pill key={tag} label={tag} tone="neutral" />
          ))}
        </View>
        {offlineCopy ? <Pill label="OFFLINE COPY" tone="neutral" /> : null}
      </View>

      {/* Plan updated */}
      {trip.planUpdated ? (
        <View style={styles.planBox}>
          <Ionicons name="warning-outline" size={18} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>{trip.planUpdated.title}</Text>
            <Text style={styles.planNote}>{trip.planUpdated.note}</Text>
          </View>
        </View>
      ) : null}

      {/* Status body */}
      {s.kind === 'loading' && (
        <>
          <View style={styles.progressBox}>
            <View style={styles.spread}>
              <View style={[styles.row, { flex: 1 }]}>
                <View style={styles.blueDot} />
                <Text style={styles.progressTitle}>
                  {s.loaded >= s.total
                    ? `✓ Ready · ${s.total} of ${s.total} processed`
                    : `Loading ${s.loaded} of ${s.total} stops loaded`}
                </Text>
              </View>
              <Text style={styles.pct}>{Math.round((s.loaded / s.total) * 100)}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((s.loaded / s.total) * 100)}%` }]} />
            </View>
            <View style={styles.spread}>
              <Text style={styles.meta}>
                Payload: <Text style={styles.metaBold}>{s.payloadKg.toLocaleString()} kg</Text>
              </Text>
              <Text style={styles.meta}>
                Volume: <Text style={styles.metaBold}>{s.volumeM3} m³</Text>
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
            onPress={() =>
              s.loaded >= s.total ? go('/tabs/manifest', { id: trip.id }) : go('/tabs/checklist')
            }
          >
            <Text style={styles.primaryText}>
              {s.loaded >= s.total ? `View ${trip.id} signed manifest` : `Continue Loading ${trip.id}`}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </>
      )}

      {s.kind === 'notStarted' && (
        <Pressable
          style={styles.spread}
          onPress={() => go('/tabs/trip-checklist', { id: trip.id })}
        >
          <View style={styles.row}>
            <Ionicons name="ellipse-outline" size={16} color="#94A3B8" />
            <Text style={styles.notStarted}>
              Not started · {s.loaded}/{s.total} stops loaded
            </Text>
          </View>
          <Text style={styles.meta}>{s.dock}</Text>
        </Pressable>
      )}

      {s.kind === 'issue' && (
        <>
          <View style={styles.issueBox}>
            <Ionicons name="warning-outline" size={18} color={t.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.issueTitle}>{s.title}</Text>
              <Text style={styles.issueDetail}>{s.detail}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.issueBtn, pressed && { opacity: 0.85 }]}
            onPress={() => go('/tabs/staging-issue', { id: trip.id })}
          >
            <Ionicons name="clipboard-outline" size={16} color={t.red} />
            <Text style={styles.issueBtnText}>View Issue & Recheck Staging</Text>
            <Ionicons name="chevron-forward" size={18} color={t.red} />
          </Pressable>
        </>
      )}

      {s.kind === 'ready' && (
        <>
          <View style={styles.readyBox}>
            <View style={styles.readyIcon}>
              <Ionicons name="checkmark" size={16} color={t.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.readyTitle}>✓ Ready to Depart</Text>
              <Text style={styles.readyNote}>
                {s.loaded}/{s.total} Loaded · Inspected & Sealed
              </Text>
            </View>
            <Ionicons name="shield-checkmark-outline" size={22} color={t.green} />
          </View>
          <View style={styles.spread}>
            <Text style={styles.driver}>Driver: {s.driver}</Text>
            <Pressable
              style={({ pressed }) => [styles.manifest, pressed && { opacity: 0.85 }]}
              onPress={() => go('/tabs/manifest', { id: trip.id })}
            >
              <Ionicons name="grid-outline" size={16} color={t.text} />
              <Text style={styles.manifestText}>Manifest</Text>
            </Pressable>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  id: { fontSize: 24, fontWeight: '800', color: t.text },
  urgentBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: t.amberSoft, borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  urgentLabel: { fontSize: 11, fontWeight: '700', color: t.amber },
  urgentTime: { fontSize: 20, fontWeight: '800', color: t.amber },
  urgentIn: { fontSize: 12, fontWeight: '700', color: t.red },
  departs: { fontSize: 16, fontWeight: '800', color: t.text },
  departsIn: { fontSize: 12, color: t.muted, marginTop: 2 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  planBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: t.amberSoft, borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 12, padding: 12,
  },
  planTitle: { fontSize: 14, fontWeight: '800', color: t.amber },
  planNote: { fontSize: 13, color: '#92400E', marginTop: 2 },
  progressBox: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: t.border,
    borderRadius: 12, padding: 12, gap: 8,
  },
  blueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.blue },
  progressTitle: { fontSize: 14, fontWeight: '700', color: t.text, flexShrink: 1 },
  pct: { fontSize: 14, fontWeight: '800', color: t.blue },
  track: { height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: t.blue, borderRadius: 999 },
  meta: { fontSize: 12, color: t.muted },
  metaBold: { fontWeight: '800', color: t.text },
  primary: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.blue, borderRadius: 14, paddingVertical: 15,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  notStarted: { fontSize: 13, color: '#475569' },
  issueBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: t.redSoft, borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, padding: 12,
  },
  issueTitle: { fontSize: 14, fontWeight: '800', color: '#B91C1C' },
  issueDetail: { fontSize: 13, color: t.red, marginTop: 2, lineHeight: 18 },
  issueBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#FCA5A5',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
  },
  issueBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: t.red },
  readyBox: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    backgroundColor: t.greenSoft, borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: 12, padding: 12,
  },
  readyIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: t.greenBg,
    alignItems: 'center', justifyContent: 'center',
  },
  readyTitle: { fontSize: 14, fontWeight: '800', color: '#166534' },
  readyNote: { fontSize: 12, color: '#15803D', marginTop: 2 },
  driver: { fontSize: 13, color: '#475569', flex: 1 },
  manifest: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: t.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  manifestText: { fontSize: 14, fontWeight: '700', color: t.text },
});