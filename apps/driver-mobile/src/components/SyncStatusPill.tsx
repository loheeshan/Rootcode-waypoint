import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/tokens';

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'offline-saved';
const CONFIG: Record<SyncStatus, { label: string; bg: string; fg: string }> = {
  synced: { label: '✓ Synced', bg: colors.successBg, fg: colors.successText },
  pending: { label: '⟳ Pending sync', bg: colors.warningBg, fg: colors.warningText },
  offline: { label: '● Offline', bg: colors.dangerBg, fg: colors.dangerText },
'offline-saved': { label: '● Offline · saved', bg: '#F1F3F9', fg: '#475467' },
};

export function SyncStatusPill({ status }: { status: SyncStatus }) {
  const { label, bg, fg } = CONFIG[status];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} accessibilityLabel={`Sync status: ${status}`}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 176,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 15, fontWeight: '700' },
});