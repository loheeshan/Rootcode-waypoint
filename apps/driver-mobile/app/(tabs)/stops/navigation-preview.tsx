import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { AppHeader } from '../../../src/components/AppHeader';
import { InfoCard } from '../../../src/components/InfoCard';
import { MapPreview } from '../../../src/components/MapPreview';
import { colors, radius, spacing } from '../../../src/theme/tokens';

export default function NavigationPreviewScreen() {
  const router = useRouter();

  // TODO: replace with real data from Expo SQLite (current trip + current stop)
  // and the real sync state from the outbox.
  const data = {
    vehicleLabel: 'VEH018 · Colombo Fresh',
    syncStatus: 'synced' as const,
    nextTurnTitle: 'Next turn · Union Place',
    nextTurnText: 'Turn right in 400 m. Keep right for the receiving ramp.',
    mapSummary: '1.8 MI | 8 MIN',
    gpsLabel: 'GPS: Strong (6.2 km left)',
    outletLines: [
      'OUT017 Waypoint Fresh',
      'Rear dock · Gate B · pass #4819',
      'Delivery window 06:00–07:00',
    ],
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <AppHeader subtitle={data.vehicleLabel} syncStatus={data.syncStatus} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Navigation preview</Text>

        <InfoCard title={data.nextTurnTitle} lines={[data.nextTurnText]} />

        <View style={styles.gap}>
          <MapPreview summary={data.mapSummary} gpsLabel={data.gpsLabel} />
        </View>

        <InfoCard title="Outlet entrance" lines={data.outletLines} />

        <Pressable
          onPress={() => router.replace('/stops')}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Return to next stop</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  heading: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  gap: { marginVertical: spacing.md },
  button: {
    marginTop: spacing.md,
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.primaryText },
});