import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';
import { SyncStatus, SyncStatusPill } from './SyncStatusPill';

type Props = {
  /** e.g. "VEH018 · Colombo Fresh" */
  subtitle: string;
  syncStatus: SyncStatus;
};

export function AppHeader({ subtitle, syncStatus }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.left}>
        <Text style={styles.title}>Waypoint</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <SyncStatusPill status={syncStatus} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  left: { flex: 1, marginRight: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: colors.onNavyMuted, marginTop: 14, letterSpacing: 0.3 },
});