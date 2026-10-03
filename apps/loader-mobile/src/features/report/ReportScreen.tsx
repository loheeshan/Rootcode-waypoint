import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { t } from '../../theme/loaderTokens';

const EXPECTED = 10;

const problemTypes = [
  { key: 'missing', label: 'Missing' },
  { key: 'damaged', label: 'Damaged' },
  { key: 'short', label: 'Quantity Short' },
  { key: 'excess', label: "Won't Fit / Excess" },
  { key: 'vehicle', label: 'Vehicle / Reefer Problem', warn: true },
] as const;

type ProblemKey = (typeof problemTypes)[number]['key'];

const actions = [
  { key: 'hold', title: 'Hold vehicle — Needs decision', note: 'Driver should not depart until replacement is staged or manifest is amended.', tag: 'BLOCKING', tone: 'red' as const },
  { key: 'go', title: 'Vehicle can leave without it', note: 'Dispatcher amends the manifest and the shortfall is carried to the next trip.', tag: 'FLOW', tone: 'green' as const },
];

export default function ReportScreen() {
  const [problem, setProblem] = useState<ProblemKey>('short');
  const [staged, setStaged] = useState(8);
  const [action, setAction] = useState<string>('hold');

  const shortBy = Math.max(EXPECTED - staged, 0);
  const severity = shortBy >= 2 ? 'SEVERE' : shortBy === 1 ? 'MINOR' : null;

  const submit = () => {
    // TODO: POST to API
    Alert.alert('Report sent', 'Dispatcher has been notified.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Report Problem</Text>

      {/* Order context */}
      <Card dark>
        <View style={styles.spread}>
          <View style={[styles.row, { flex: 1 }]}>
            <Ionicons name="bus-outline" size={14} color="#CBD5E1" />
            <Text style={styles.darkCaps} numberOfLines={1}>VEH018 · TRIP 1 · LOADING ISSUE</Text>
          </View>
          <View style={styles.exception}>
            <View style={styles.dot} />
            <Text style={styles.exceptionText}>EXCEPTION LOG</Text>
          </View>
        </View>
        <Text style={styles.orderMeta}>ORD0092322 · OUT027 · Milk 1L</Text>
        <Text style={styles.product}>Fresh Milk 1L Whole</Text>
        <View style={{ marginTop: 10 }}>
          <Pill label="Chilled 10-pack crates" tone="cyan" icon="snow-outline" />
        </View>
      </Card>

      {/* Classification */}
      <Card>
        <View style={styles.spread}>
          <View style={styles.row}>
            <Ionicons name="warning-outline" size={16} color={t.blue} />
            <Text style={styles.cardTitle}>Problem Classification</Text>
          </View>
          <Text style={styles.muted}>Tap to switch</Text>
        </View>
        <View style={styles.grid}>
          {problemTypes.map((p) => {
            const selected = p.key === problem;
            return (
              <Pressable
                key={p.key}
                onPress={() => setProblem(p.key)}
                style={[styles.option, p.key === 'vehicle' && styles.full, selected && styles.optionOn]}
              >
                <View style={[styles.row, { flex: 1 }]}>
                  {'warn' in p && p.warn ? <Ionicons name="warning" size={14} color="#D97706" /> : null}
                  <Text style={[styles.optionText, selected && { color: '#fff' }]} numberOfLines={1}>
                    {p.label}
                  </Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                ) : (
                  <View style={styles.radio} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Staged vs expected */}
      <Card>
        <View style={styles.spread}>
          <Text style={styles.cardTitle}>Staged vs Expected</Text>
          <Pill label={`Expected: ${EXPECTED} crates`} tone="neutral" />
        </View>
        <View style={styles.stepper}>
          <Pressable style={styles.stepBtn} onPress={() => setStaged((n) => Math.max(0, n - 1))}>
            <Ionicons name="remove" size={22} color={t.text} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.count}>
              {staged} <Text style={styles.countUnit}>CRATES</Text>
            </Text>
            <Text style={styles.muted}>Available on Dock</Text>
          </View>
          <Pressable style={styles.stepBtn} onPress={() => setStaged((n) => Math.min(EXPECTED, n + 1))}>
            <Ionicons name="add" size={22} color={t.text} />
          </Pressable>
        </View>

        {severity ? (
          <View style={styles.shortBar}>
            <Ionicons name="alert-circle" size={16} color={t.red} />
            <Text style={styles.shortText}>Short by {shortBy} crate{shortBy > 1 ? 's' : ''}</Text>
            <Pill label={severity} tone="red" solid />
          </View>
        ) : (
          <View style={[styles.shortBar, { backgroundColor: t.greenSoft, borderColor: '#BBF7D0' }]}>
            <Ionicons name="checkmark-circle" size={16} color={t.green} />
            <Text style={[styles.shortText, { color: t.green }]}>Matches expected quantity</Text>
          </View>
        )}
      </Card>

      {/* Dispatcher action */}
      <Card>
        <View style={styles.spread}>
          <View style={styles.row}>
            <Ionicons name="flag" size={14} color="#F59E0B" />
            <Text style={styles.cardTitle}>Dispatcher Action Required</Text>
          </View>
          <Text style={styles.muted}>Mandatory</Text>
        </View>
        <View style={{ gap: 10, marginTop: 12 }}>
          {actions.map((a) => {
            const selected = a.key === action;
            return (
              <Pressable
                key={a.key}
                onPress={() => setAction(a.key)}
                style={[styles.action, selected && (a.tone === 'red' ? styles.actionOn : styles.actionOnGreen)]}
              >
                <View style={[styles.radioOuter, selected && { borderColor: t.blue }]}>
                  {selected ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.spread}>
                    <Text style={styles.actionTitle}>{a.title}</Text>
                    <Pill label={a.tag} tone={a.tone} />
                  </View>
                  <Text style={styles.mutedSmall}>{a.note}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Pressable style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]} onPress={submit}>
        <Ionicons name="send-outline" size={18} color="#fff" />
        <Text style={styles.ctaText}>Send Report to Dispatcher</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: t.text, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  muted: { fontSize: 12, color: t.muted },
  mutedSmall: { fontSize: 12, color: t.muted, lineHeight: 17 },
  darkCaps: { fontSize: 11, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.4, flexShrink: 1 },
  exception: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, flexShrink: 0,
    borderColor: 'rgba(248,113,113,0.5)', backgroundColor: 'rgba(220,38,38,0.15)',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F87171' },
  exceptionText: { fontSize: 10, fontWeight: '800', color: '#F87171', letterSpacing: 0.4 },
  orderMeta: { fontSize: 13, color: '#94A3B8', marginTop: 12 },
  product: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: t.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  option: {
    flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: t.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14, backgroundColor: '#fff',
  },
  full: { flexBasis: '100%' },
  optionOn: { backgroundColor: t.blue, borderColor: t.blue },
  optionText: { fontSize: 14, fontWeight: '700', color: t.text, flexShrink: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#CBD5E1' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: t.border,
    borderRadius: 14, padding: 10, marginTop: 12,
  },
  stepBtn: {
    width: 50, height: 50, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center',
  },
  count: { fontSize: 30, fontWeight: '800', color: t.text },
  countUnit: { fontSize: 12, fontWeight: '700', color: t.muted, letterSpacing: 0.5 },
  shortBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: t.redSoft, borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  shortText: { flex: 1, fontSize: 13, fontWeight: '700', color: t.red },
  action: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12, backgroundColor: '#fff',
  },
  actionOn: { backgroundColor: t.amberSoft, borderColor: '#93C5FD' },
  actionOnGreen: { backgroundColor: t.greenSoft, borderColor: '#86EFAC' },
  actionTitle: { fontSize: 14, fontWeight: '800', color: t.text, flex: 1 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.blue },
  cta: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.blue, borderRadius: 14, paddingVertical: 16,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});