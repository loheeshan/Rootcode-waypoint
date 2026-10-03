// src/features/checklist/ChecklistScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui/Card';
import { Pill, type PillTone } from '../../components/ui/Pill';
import { t } from '../../theme/loaderTokens';

type Stop = {
  id: string;
  order: string; // "LOAD 1ST · DEEPEST"
  stop: number;
  outlet: string;
  cartons: number;
  temp: string;
  tempTone: PillTone;
  loaded: boolean;
};

const initialStops: Stop[] = [
  { id: 'OUT081', order: 'LOAD 1ST · DEEPEST', stop: 7, outlet: 'OUT081 · Keells Wattala', cartons: 18, temp: 'Chilled 4°C', tempTone: 'cyan', loaded: true },
  { id: 'OUT065', order: 'LOAD 2ND', stop: 6, outlet: 'OUT065 · Cargills Ja-Ela', cartons: 14, temp: 'Ambient Dry', tempTone: 'neutral', loaded: true },
  { id: 'OUT052', order: 'LOAD 3RD', stop: 5, outlet: 'OUT052 · Glomark Ne…', cartons: 22, temp: 'Chilled 2°C', tempTone: 'cyan', loaded: true },
  { id: 'OUT038', order: 'LOAD 4TH', stop: 4, outlet: 'OUT038 · Arpico Negombo', cartons: 16, temp: 'Chilled 4°C', tempTone: 'cyan', loaded: true },
  { id: 'OUT027', order: 'LOAD 5TH', stop: 3, outlet: 'OUT027 · Arpico Supercentre', cartons: 10, temp: 'Chilled 4°C', tempTone: 'cyan', loaded: true },
  { id: 'OUT019', order: 'LOAD 6TH', stop: 2, outlet: 'OUT019 · Keells Peliyagoda', cartons: 12, temp: 'Ambient Dry', tempTone: 'neutral', loaded: false },
  { id: 'OUT011', order: 'LOAD 7TH · NEAREST DOOR', stop: 1, outlet: 'OUT011 · Cargills Kiribathgoda', cartons: 9, temp: 'Chilled 2°C', tempTone: 'cyan', loaded: false },
];

export default function ChecklistScreen() {
  const [stops, setStops] = useState(initialStops);
  const [stagingAck, setStagingAck] = useState(false);

  const loadedCount = stops.filter((s) => s.loaded).length;
  const pct = Math.round((loadedCount / stops.length) * 100);

  const toggle = (id: string) =>
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, loaded: !s.loaded } : s)));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Load Checklist</Text>

      {/* Vehicle summary */}
      <Card dark>
        <View style={styles.spread}>
          <View style={styles.row}>
            <Text style={styles.vehicle}>VEH018</Text>
            <Text style={styles.trip}>· Trip 1</Text>
            <Pill label="REEFER TRUCK" tone="navy" />
          </View>
          <Pill label="4°C ACTIVE" tone="cyan" icon="snow-outline" />
        </View>
        <Text style={styles.driver}>Sunil Perera · Est. Departure 03:30</Text>

        <View style={styles.divider} />

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="scale-outline" size={20} color="#94A3B8" />
            <View>
              <Text style={styles.statLabel}>GROSS LOAD</Text>
              <Text style={styles.statValue}>1,820 kg</Text>
            </View>
          </View>
          <View style={styles.stat}>
            <Ionicons name="cube-outline" size={20} color="#94A3B8" />
            <View>
              <Text style={styles.statLabel}>VOLUME USED</Text>
              <Text style={styles.statValue}>14.4 m³</Text>
            </View>
          </View>
        </View>

        <View style={[styles.spread, { marginTop: 14 }]}>
          <Text style={styles.statValueSm}>Loading Progress</Text>
          <Text style={styles.statValueSm}>
            {loadedCount} of {stops.length} orders ({pct}%)
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.spread}>
          <Text style={styles.hint}>Deep Interior (Bulk)</Text>
          <Text style={styles.hint}>Rear Tailgate</Text>
        </View>
      </Card>

      {/* Staging change alert */}
      {!stagingAck && (
        <View style={styles.alert}>
          <View style={styles.row}>
            <Ionicons name="warning" size={16} color="#D97706" />
            <Text style={styles.alertTitle}>REV 3 STAGING CHANGE</Text>
          </View>
          <Text style={styles.alertBody}>
            ORD0092350 (OUT044) reassigned to VEH022. Remove staging unit before locking bay.
          </Text>
          <Pressable style={styles.ackBtn} onPress={() => setStagingAck(true)}>
            <Ionicons name="checkmark" size={16} color={t.green} />
            <Text style={styles.ackText}>Got it — Removed</Text>
          </Pressable>
        </View>
      )}

      {/* Reverse stop protocol */}
      <View style={styles.row}>
        <Ionicons name="sync-outline" size={14} color={t.blue} />
        <Text style={styles.protocol}>REVERSE STOP PROTOCOL</Text>
        <Text style={styles.protocolSub}>First-In, Last-Out (FILO)</Text>
      </View>

      <View style={{ gap: 10 }}>
        {stops.map((s) => (
          <Pressable key={s.id} onPress={() => toggle(s.id)}>
            <Card style={styles.stopCard}>
              <View style={[styles.tick, s.loaded && styles.tickDone]}>
                {s.loaded ? <Ionicons name="checkmark" size={18} color={t.green} /> : null}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.row}>
                  <Text style={styles.orderLabel}>{s.order}</Text>
                  <Pill label={`Stop ${s.stop}`} tone="neutral" />
                </View>
                <Text style={styles.outlet} numberOfLines={1}>{s.outlet}</Text>
                <View style={styles.row}>
                  <Text style={styles.cartons}>{s.cartons} Cartons</Text>
                  <Pill label={s.temp} tone={s.tempTone} />
                </View>
              </View>
              <Pill label={s.loaded ? 'Loaded' : 'Pending'} tone={s.loaded ? 'green' : 'amber'} />
            </Card>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: t.text, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehicle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  trip: { fontSize: 14, color: '#94A3B8' },
  driver: { fontSize: 14, color: '#CBD5E1', marginTop: 8 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.navySoft, borderRadius: 12, padding: 12 },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statValueSm: { fontSize: 13, fontWeight: '600', color: '#fff' },
  track: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 8, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 999 },
  hint: { fontSize: 11, color: '#94A3B8' },
  alert: {
    backgroundColor: t.amberSoft, borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 14, padding: 14, gap: 8,
  },
  alertTitle: { fontSize: 12, fontWeight: '800', color: t.amber, letterSpacing: 0.4 },
  alertBody: { fontSize: 14, fontWeight: '700', color: '#92400E', lineHeight: 20 },
  ackBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#86EFAC',
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4,
  },
  ackText: { fontSize: 13, fontWeight: '700', color: '#15803D' },
  protocol: { fontSize: 12, fontWeight: '800', color: t.blue, letterSpacing: 0.4 },
  protocolSub: { fontSize: 12, color: t.muted },
  stopCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tick: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  tickDone: { backgroundColor: t.greenSoft, borderColor: '#86EFAC' },
  orderLabel: { fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 0.3 },
  outlet: { fontSize: 16, fontWeight: '800', color: t.text },
  cartons: { fontSize: 13, color: t.muted },
});