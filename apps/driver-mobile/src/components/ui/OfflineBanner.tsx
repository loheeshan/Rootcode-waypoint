import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/colors';

export function OfflineBanner({ queuedCount }: { queuedCount?: number }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>⚠ No connection · Working offline</Text>
      {queuedCount !== undefined && (
        <View style={styles.pill}>
          <Text style={styles.pillText}>QUEUED</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.warning, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  text: { color: '#1A1300', fontWeight: '700', fontSize: 13 },
  pill: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { color: '#1A1300', fontSize: 11, fontWeight: '800' },
});