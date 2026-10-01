import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { colors, spacing, radius } from '../../../src/theme/colors';
import { Badge } from '../../../src/components/ui/Badge';

export default function NextStopScreen() {
  const handleCallReceiver = () => {
    // TODO: pull the real receiver phone number from the trip/stop record
    Linking.openURL('tel:+94000000000');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.routeTitle}>Waypoint</Text>
          <Text style={styles.routeSub}>Route #TRP-8420</Text>
        </View>
        <Badge label="● Synced" tone="success" />
      </View>

      <View style={styles.stopCard}>
        <View style={styles.stopTopRow}>
          <Badge label="● NEXT · Stop 4 of 7" tone="info" />
          <Text style={styles.outletId}>OUT017</Text>
        </View>
        <Text style={styles.outletName}>OUT017 Waypoint Fresh</Text>
        <Text style={styles.outletAddress}>📍 Central Plaza, Level B2 North Bay</Text>

        <View style={styles.windowRow}>
          <View>
            <Text style={styles.windowLabel}>⏱ DELIVERY WINDOW</Text>
            <Text style={styles.windowValue}>09:00 – 12:00</Text>
          </View>
          <View>
            <Text style={styles.windowLabel}>PLANNED ETA</Text>
            <Text style={[styles.windowValue, { color: colors.success }]}>08:15</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Stop 01–03 Complete</Text>
          <Badge label="Stop 04 Active" tone="info" />
          <Text style={styles.progressText}>3 Stops Remaining</Text>
        </View>
      </View>

      <View style={styles.warningCard}>
        <View style={styles.warningHeaderRow}>
          <Badge label="⚠ BAY ACCESS CLOSED" tone="warning" />
          <Text style={styles.dockTag}>Dock: REAR_DOCK</Text>
        </View>
        <Text style={styles.warningTitle}>Mall loading bay access: CLOSED — window is 09:00–12:00, current time 08:15.</Text>

        <View style={styles.waitBox}>
          <Text style={styles.waitTitle}>⏱ Wait 45 min until gate unlocks (09:00)</Text>
          <Text style={styles.waitSub}>Time limit strictly enforced by plaza security. Hydraulic gate closed.</Text>
        </View>

        <View style={styles.gateRow}>
          <Text style={styles.gateText}>🔒 Security Gate B Pinpad #4819</Text>
          <Text style={styles.gateLocked}>Locked until 09:00</Text>
        </View>

        <Pressable style={styles.callButton} onPress={handleCallReceiver}>
          <Text style={styles.callButtonText}>📞 Call Receiver (Nasser)</Text>
        </Pressable>
      </View>

      <View style={styles.trafficCard}>
        <View style={styles.trafficHeaderRow}>
          <Text style={styles.trafficTitle}>↗ Turn-by-Turn Preview</Text>
          <Badge label="Traffic Clear" tone="success" />
        </View>
        <View style={styles.turnRow}>
          <View style={styles.turnIcon}><Text style={{ color: colors.white }}>➜</Text></View>
          <View>
            <Text style={styles.turnText}>Turn Right in 400m</Text>
            <Text style={styles.turnSub}>onto Union Place (Keep right lane for ramp)</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  routeTitle: { color: colors.white, fontWeight: '800', fontSize: 16 },
  routeSub: { color: colors.textMuted, fontSize: 11 },
  stopCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  stopTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  outletId: { color: colors.textMuted, fontSize: 11 },
  outletName: { color: colors.white, fontSize: 17, fontWeight: '800', marginTop: spacing.sm },
  outletAddress: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  windowRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  windowLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  windowValue: { color: colors.white, fontSize: 16, fontWeight: '800', marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  progressText: { color: colors.textMuted, fontSize: 11 },
  warningCard: { backgroundColor: 'rgba(245,166,35,0.08)', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.warning, marginBottom: spacing.md },
  warningHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dockTag: { color: colors.textMuted, fontSize: 11 },
  warningTitle: { color: colors.white, fontSize: 13, fontWeight: '700', marginTop: spacing.sm, lineHeight: 19 },
  waitBox: { marginTop: spacing.md },
  waitTitle: { color: colors.warning, fontSize: 13, fontWeight: '700' },
  waitSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  gateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(245,166,35,0.3)' },
  gateText: { color: colors.textSecondary, fontSize: 12 },
  gateLocked: { color: colors.textMuted, fontSize: 11 },
  callButton: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  callButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  trafficCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  trafficHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trafficTitle: { color: colors.white, fontSize: 13, fontWeight: '700' },
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  turnIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  turnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  turnSub: { color: colors.textMuted, fontSize: 11 },
});