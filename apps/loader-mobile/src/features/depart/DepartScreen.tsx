// src/features/depart/DepartScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { t } from '../../theme/loaderTokens';

const gates: {
  title: string;
  note: string;
  icon: keyof typeof Ionicons.glyphMap;
  done: boolean;
}[] = [
  { title: 'Cargo locked & strapped', note: 'Barriers & load bars locked', icon: 'lock-closed-outline', done: true },
  { title: 'Reefer set-point confirmed', note: '+4°C verified on logger #TM-04', icon: 'snow-outline', done: true },
  { title: 'Rear shutter seal intact', note: 'Tamper tag #SL-99420 recorded', icon: 'pricetag-outline', done: true },
];

export default function DepartScreen() {
  const passed = gates.filter((g) => g.done).length;
  const allPassed = passed === gates.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ready To Depart</Text>

      {/* Vehicle */}
      <Card style={styles.row}>
        <View style={styles.vehicleIcon}>
          <Ionicons name="bus-outline" size={22} color={t.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleTitle}>VEH018 · Trip 1</Text>
          <Text style={styles.caps}>FRESH REEFER · PELIYAGODA BAY 4</Text>
        </View>
        <Pill label="Bay Clear Ready" tone="green" icon="ellipse" />
      </Card>

      {/* Load completion */}
      <Card dark>
        <View style={styles.spread}>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#34D399" />
            <Text style={styles.darkCaps}>LOAD COMPLETION</Text>
          </View>
          <Pill label="100% DONE" tone="green" solid />
        </View>
        <Text style={styles.darkHeadline}>All 7 of 7 Orders Processed</Text>
        <View style={styles.divider} />
        <View style={styles.stats}>
          <View style={styles.stat}>
            <View style={styles.row}>
              <Ionicons name="cube-outline" size={14} color="#94A3B8" />
              <Text style={styles.darkCaps}>STOWED & CHECKED</Text>
            </View>
            <Text style={styles.statValue}>
              7 <Text style={styles.statUnit}>/ 7 drops</Text>
            </Text>
          </View>
          <View style={styles.stat}>
            <View style={styles.row}>
              <Ionicons name="scale-outline" size={14} color="#94A3B8" />
              <Text style={styles.darkCaps}>GROSS CARGO WEIGHT</Text>
            </View>
            <Text style={styles.statValue}>
              1,780 <Text style={styles.statUnit}>kg</Text>
            </Text>
          </View>
        </View>
      </Card>

      {/* Acknowledged issue */}
      <Card>
        <View style={styles.spread}>
          <View style={[styles.row, { flex: 1 }]}>
            <Ionicons name="warning-outline" size={18} color="#F59E0B" />
            <Text style={styles.cardTitle}>1 Acknowledged Issue on Manifest</Text>
          </View>
          <Pill label="RECONCILED" tone="amber" />
        </View>

        <View style={styles.issueBox}>
          <View style={styles.spread}>
            <Text style={styles.orderId}>ORD0092322</Text>
            <Pill label="Short by 2 crates" tone="red" />
          </View>
          <Text style={styles.muted}>Stop 3 · OUT027 Arpico Supercentre</Text>

          <View style={styles.approved}>
            <Ionicons name="sync-circle-outline" size={18} color={t.green} />
            <Text style={styles.approvedText}>
              Dispatcher Notified & Approved at 03:14 (Manifest rev 3.1)
            </Text>
          </View>

          <Text style={styles.mutedSmall}>ORD0092322 · OUT027 · Milk 1L</Text>
          <Text style={styles.mutedSmall}>
            8 of 10 accepted. The shortfall is recorded on the manifest.
          </Text>
        </View>
      </Card>

      {/* Inspection gates */}
      <Card>
        <View style={styles.spread}>
          <View style={styles.row}>
            <Ionicons name="shield-checkmark-outline" size={18} color={t.blue} />
            <Text style={styles.cardTitle}>Inspection Gates</Text>
          </View>
          <Pill label={`${passed} of ${gates.length} Passed`} tone="green" />
        </View>

        <View style={{ gap: 8, marginTop: 12 }}>
          {gates.map((g) => (
            <View key={g.title} style={styles.gate}>
              <Ionicons
                name={g.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={g.done ? t.green : '#CBD5E1'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.gateTitle}>{g.title}</Text>
                <Text style={styles.mutedSmall}>{g.note}</Text>
              </View>
              <Ionicons name={g.icon} size={18} color="#94A3B8" />
            </View>
          ))}
        </View>
      </Card>

      <Pressable
        disabled={!allPassed}
        onPress={() => {
          // TODO: call depart API / navigate
        }}
        style={({ pressed }) => [
          styles.cta,
          !allPassed && { opacity: 0.4 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="navigate-outline" size={18} color="#fff" />
        <Text style={styles.ctaText}>Release Vehicle to Depart</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: t.text, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  vehicleIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: t.blueBg,
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleTitle: { fontSize: 17, fontWeight: '800', color: t.text },
  caps: { fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 0.4, marginTop: 2 },
  darkCaps: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  darkHeadline: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: t.navySoft, borderRadius: 12, padding: 12, gap: 8 },
  statValue: { fontSize: 26, fontWeight: '800', color: '#fff' },
  statUnit: { fontSize: 14, fontWeight: '500', color: '#94A3B8' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: t.text, flexShrink: 1 },
  issueBox: {
    marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 12,
    borderWidth: 1, borderColor: t.border, padding: 12, gap: 6,
  },
  orderId: { fontSize: 15, fontWeight: '800', color: t.text },
  muted: { fontSize: 13, color: t.muted },
  mutedSmall: { fontSize: 12, color: t.muted },
  approved: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: t.greenSoft, borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: 10, padding: 10, marginVertical: 6,
  },
  approvedText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#15803D' },
  gate: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1,
    borderColor: t.border, padding: 12,
  },
  gateTitle: { fontSize: 15, fontWeight: '700', color: t.text },
  cta: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.blue, borderRadius: 14, paddingVertical: 16, marginTop: 4,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});