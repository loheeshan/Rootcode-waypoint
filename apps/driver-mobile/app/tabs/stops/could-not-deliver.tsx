import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '../../../src/theme/colors';
import { Badge } from '../../../src/components/';
import { OfflineBanner } from '../../../src/components/ui/OfflineBanner';
import { AppButton } from '../../../src/components/ui/Button';

type Reason = 'store_closed' | 'access_blocked' | 'no_one_to_receive' | 'goods_damaged' | 'rejected_by_store' | 'mall_window_missed' | 'other';

const PRIMARY_REASONS: { key: Reason; label: string; icon: string }[] = [
  { key: 'store_closed', label: 'Store Closed / Locked', icon: '🔒' },
  { key: 'access_blocked', label: 'Access Blocked / Dock Obstructed', icon: '🚫' },
  { key: 'no_one_to_receive', label: 'No One to Receive', icon: '🧍' },
];

const SECONDARY_REASONS: { key: Reason; label: string; icon: string }[] = [
  { key: 'goods_damaged', label: 'Goods Damaged in Transit', icon: '📦' },
  { key: 'rejected_by_store', label: 'Delivery Rejected by Store', icon: '↩' },
  { key: 'mall_window_missed', label: 'Mall Loading Window Missed', icon: '🕐' },
  { key: 'other', label: 'Other / Road Impasse', icon: '⚠' },
];

export default function CouldNotDeliverScreen() {
  const [selected, setSelected] = useState<Reason>('access_blocked');
  const [pendingSyncCount] = useState(4); // TODO: read real count from SQLite outbox (Lisha's sync layer)

  const handleSubmit = () => {
    // TODO: write to local SQLite outbox with status 'pending';
    // the sync layer (feature/driver-sync) flushes it to
    // POST /api/v1/sync/events once connectivity returns.
  };

  return (
    <View style={styles.screen}>
      <OfflineBanner queuedCount={pendingSyncCount} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Waypoint</Text>
          <Text style={styles.headerSub}>DRIVER LOGISTICS</Text>
        </View>
        <Badge label="● Offline" tone="warning" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.dot} />
          <Text style={styles.title}>Could Not Deliver</Text>
          <Text style={styles.vehicleTag}>VEH018</Text>
        </View>

        <View style={styles.stopCard}>
          <View style={styles.stopBadge}><Text style={styles.stopBadgeText}>04</Text></View>
          <View style={{ flex: 1 }}>
            <View style={styles.stopTitleRow}>
              <Text style={styles.stopOutlet}>Stop 4: OUT017</Text>
              <Badge label="Cold Fresh" tone="info" />
            </View>
            <Text style={styles.stopAddress}>Waypoint Fresh • Main Distribution Dock</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>SELECT PRIMARY REASON FOR DELIVERY FAILURE: <Text style={styles.required}>REQUIRED</Text></Text>

        {PRIMARY_REASONS.map((reason) => (
          <Pressable key={reason.key} style={[styles.reasonRow, selected === reason.key && styles.reasonRowSelected]} onPress={() => setSelected(reason.key)}>
            <Text style={styles.reasonIcon}>{reason.icon}</Text>
            <Text style={styles.reasonLabel}>{reason.label}</Text>
            <View style={[styles.radio, selected === reason.key && styles.radioSelected]}>
              {selected === reason.key && <Text style={styles.radioCheck}>✓</Text>}
            </View>
          </Pressable>
        ))}

        <View style={styles.gridWrap}>
          {SECONDARY_REASONS.map((reason) => (
            <Pressable key={reason.key} style={[styles.gridItem, selected === reason.key && styles.reasonRowSelected]} onPress={() => setSelected(reason.key)}>
              <Text style={styles.reasonIcon}>{reason.icon}</Text>
              <Text style={styles.gridLabel}>{reason.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>EVIDENCE & DOCUMENTATION:</Text>
        <View style={styles.evidenceCard}>
          <View style={styles.evidenceHeaderRow}>
            <Text style={styles.evidenceLabel}>TAKE PHOTO OF CLOSED GATE / OBSTRUCTION</Text>
            <Text style={styles.attachedTag}>✓ Attached</Text>
          </View>
          <View style={styles.evidenceRow}>
            {/* TODO: wire to expo-image-picker and show the real captured photo URI */}
            <View style={styles.evidenceThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.evidenceFile}>Bay_Gate_Locked.jpg</Text>
              <Text style={styles.evidenceMeta}>08:14 AM • GPS: 6.9271, 79.8612</Text>
              <Pressable><Text style={styles.retakeText}>↻ Retake Photo</Text></Pressable>
            </View>
          </View>
        </View>

        <AppButton label="Save — Will Notify Dispatch When Online" variant="danger" onPress={handleSubmit} />
      </ScrollView>

      <View style={styles.tabBar}>
        <Text style={styles.tabItem}>🚚{'\n'}Today</Text>
        <Text style={[styles.tabItem, styles.tabActive]}>📍{'\n'}Stops</Text>
        <Text style={styles.tabItem}>↻{'\n'}Sync ({pendingSyncCount})</Text>
        <Text style={styles.tabItem}>👤{'\n'}Profile</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.white, fontWeight: '800', fontSize: 16 },
  headerSub: { color: colors.textMuted, fontSize: 10 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginRight: spacing.sm },
  title: { color: colors.white, fontSize: 18, fontWeight: '800' },
  vehicleTag: { color: colors.textMuted, fontSize: 11, marginLeft: 'auto' },
  stopCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, gap: spacing.sm },
  stopBadge: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  stopBadgeText: { color: colors.white, fontWeight: '800' },
  stopTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stopOutlet: { color: colors.white, fontWeight: '700', fontSize: 14 },
  stopAddress: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.sm },
  required: { color: '#60A5FA' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  reasonRowSelected: { borderColor: colors.primary, backgroundColor: 'rgba(59,78,224,0.12)' },
  reasonIcon: { fontSize: 16 },
  reasonLabel: { color: colors.white, flex: 1, fontSize: 13, fontWeight: '600' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  radioCheck: { color: colors.white, fontSize: 11, fontWeight: '800' },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  gridItem: { width: '48%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  gridLabel: { color: colors.white, fontSize: 12, fontWeight: '600', marginTop: spacing.xs },
  evidenceCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  evidenceHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  evidenceLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', flex: 1 },
  attachedTag: { color: colors.success, fontSize: 11, fontWeight: '700' },
  evidenceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  evidenceThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.border },
  evidenceFile: { color: colors.white, fontSize: 13, fontWeight: '600' },
  evidenceMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  retakeText: { color: '#60A5FA', fontSize: 12, marginTop: spacing.xs },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  tabItem: { color: colors.textMuted, fontSize: 10, textAlign: 'center' },
  tabActive: { color: colors.primary, fontWeight: '700' },
});