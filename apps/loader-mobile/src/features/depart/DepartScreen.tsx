import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useIsOffline } from '../../hooks/useIsOffline';
import { t } from '../../theme/loaderTokens';
import { useDialog } from '../dialogs/DialogProvider';
import type { DialogId } from '../dialogs/dialogs';

type GateStatus = 'pass' | 'fail';

type GateDef = {
  key: string;
  title: string;
  note: string;
  failTitle?: string;
  failNote?: string;
  icon: keyof typeof Ionicons.glyphMap;
  dialog: DialogId;
};

const gateDefs: GateDef[] = [
  { key: 'cargo', title: 'Cargo locked & strapped', note: 'Barriers & load bars locked', icon: 'lock-closed-outline', dialog: 'cargoSecured' },
  {
    key: 'reefer', title: 'Reefer set-point confirmed', note: '+4°C verified on logger #TM-04',
    failTitle: 'Reefer set-point breach',
    failNote: 'Logger #TH-04 reads +12°C — required set-point +4°C for this chilled trip.',
    icon: 'snow-outline', dialog: 'chilledSetpoint',
  },
  { key: 'seal', title: 'Rear shutter seal intact', note: 'Tamper tag #SL-99420 recorded', icon: 'pricetag-outline', dialog: 'shutterSeal' },
];

export default function DepartScreen() {
  const router = useRouter();
  const offline = useIsOffline();
  const { openDialog } = useDialog();

  const [status, setStatus] = useState<Record<string, GateStatus>>({ cargo: 'pass', reefer: 'pass', seal: 'pass' });
  const [acknowledged, setAcknowledged] = useState(false);

  const passed = gateDefs.filter((g) => status[g.key] === 'pass').length;
  const allPassed = passed === gateDefs.length;
  const blocked = !acknowledged || !allPassed;

  const inspect = (g: GateDef) =>
    openDialog(g.dialog, (key) => {
      if (key === 'passed') setStatus((s) => ({ ...s, [g.key]: 'pass' }));
      if (key === 'failed') setStatus((s) => ({ ...s, [g.key]: 'fail' }));
    });

    const release = () => {
    if (!acknowledged) return openDialog('finishChecks');
    if (!allPassed) return openDialog('inspectionRequired');
    if (offline) return openDialog('saveSignoffOffline');
    openDialog('markReady');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {offline && (
        <StatusBanner message="No connection — sign-off will be recorded locally and sync automatically." />
      )}

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

      {/* Acknowledged issue: tap to acknowledge */}
      <Pressable
        onPress={() =>
          openDialog('acknowledgeIssue', (key) => {
            if (key === 'ack') setAcknowledged(true);
          })
        }
      >
        <Card style={offline ? styles.issueCardOffline : undefined}>
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
          <Text style={[styles.ackHint, acknowledged && { color: t.green }]}>
            {acknowledged ? '✓ Acknowledged' : 'Tap to acknowledge before sign-off'}
          </Text>
        </Card>
      </Pressable>

      {/* Inspection gates */}
      <Card>
        <View style={styles.spread}>
          <View style={styles.row}>
            <Ionicons name="shield-checkmark-outline" size={18} color={t.blue} />
            <Text style={styles.cardTitle}>Inspection Gates</Text>
          </View>
          <Pill
            label={`${passed} of ${gateDefs.length} Passed`}
            tone={allPassed ? 'green' : 'red'}
            icon={allPassed ? undefined : 'ellipse'}
          />
        </View>

        <View style={{ gap: 8, marginTop: 12 }}>
          {gateDefs.map((g) => {
            const failed = status[g.key] === 'fail';
            return (
              <Pressable key={g.key} onPress={() => inspect(g)} style={[styles.gate, failed && styles.gateFail]}>
                <Ionicons
                  name={failed ? 'close-circle' : 'checkmark-circle'}
                  size={24}
                  color={failed ? t.red : t.green}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
                    <Text style={[styles.gateTitle, failed && { color: '#991B1B' }]}>
                      {failed ? (g.failTitle ?? g.title) : g.title}
                    </Text>
                    {failed ? <Pill label="FAILED" tone="red" solid /> : null}
                  </View>
                  <Text style={[styles.mutedSmall, failed && { color: t.red }]}>
                    {failed ? (g.failNote ?? 'Failed · vehicle on hold') : g.note}
                  </Text>
                </View>
                <View style={failed ? styles.failIcon : undefined}>
                  <Ionicons name={g.icon} size={18} color={failed ? t.red : '#94A3B8'} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Pressable
        onPress={release}
        style={({ pressed }) => [styles.cta, blocked && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="navigate-outline" size={18} color="#fff" />
        <Text style={styles.ctaText}>
          {offline ? 'Sign Off & Depart (saves offline)' : 'Release Vehicle to Depart'}
        </Text>
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
  issueCardOffline: { backgroundColor: t.amberSoft, borderColor: '#FDE68A' },
  issueBox: {
    marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 12,
    borderWidth: 1, borderColor: t.border, padding: 12, gap: 6,
  },
  orderId: { fontSize: 15, fontWeight: '800', color: t.text },
  muted: { fontSize: 13, color: t.muted },
  mutedSmall: { fontSize: 12, color: t.muted, lineHeight: 17 },
  approved: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: t.greenSoft, borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: 10, padding: 10, marginVertical: 6,
  },
  approvedText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#15803D' },
  ackHint: { fontSize: 12, fontWeight: '700', color: t.amber, marginTop: 10 },
  gate: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1,
    borderColor: t.border, padding: 12,
  },
  gateFail: { backgroundColor: t.redSoft, borderColor: '#FECACA' },
  gateTitle: { fontSize: 15, fontWeight: '700', color: t.text },
  failIcon: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: t.redBg,
    alignItems: 'center', justifyContent: 'center',
  },
  cta: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.blue, borderRadius: 14, paddingVertical: 16, marginTop: 4,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});