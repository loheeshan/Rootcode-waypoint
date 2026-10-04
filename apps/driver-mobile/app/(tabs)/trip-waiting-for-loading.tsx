import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { InfoCard } from '../../src/components/InfoCard';
import { WarningCard } from '../../src/components/WarningCard';
import { colors, radius, spacing } from '../../src/theme/tokens';

export default function TripWaitingForLoadingScreen() {
  const router = useRouter();

  // TODO(feature/driver-sqlite, feature/driver-sync): replace with the real trip from
  // Expo SQLite. The trip becomes startable when the loader marks it ready
  // (POST /api/v1/trips/{id}/ready) and the driver app syncs.
  const trip = {
    number: 2,
    depotName: 'Gampaha North',
    stopCount: 5,
    scheduledAt: '05:40',
    bay: 'Bay L2',
    vehicleId: 'VEH018',
    payloadKg: '1,120',
    vehicleLabel: 'VEH018 · Colombo Fresh',
  };

  const handleContactLoadingDesk = () => {
    // TODO: point this at a dedicated "contact loading desk" screen if the design adds one.
    router.push('/contact-dispatcher');
  };

  const handleBackToToday = () => {
    router.replace('/today');
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <AppHeader subtitle={trip.vehicleLabel} syncStatus="synced" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Trip {trip.number} · Waiting for loading</Text>

        <WarningCard
          title="Loading not complete"
          message={`${trip.depotName} · ${trip.stopCount} stops · scheduled ${trip.scheduledAt}. The trip can start once the loader confirms the vehicle is ready.`}
        />

        <View style={styles.cardGap}>
          <InfoCard
            title={`${trip.bay} · ${trip.vehicleId}`}
            lines={[
              `Estimated payload ${trip.payloadKg} kg. Your current trip remains available offline.`,
            ]}
          />
        </View>

        <Pressable
          onPress={handleContactLoadingDesk}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Contact loading desk</Text>
        </Pressable>

        <Pressable
          onPress={handleBackToToday}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Back to today</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  cardGap: { marginTop: spacing.md },
  primaryButton: {
    marginTop: spacing.md,
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.primaryText },
  secondaryButton: {
    marginTop: spacing.sm,
    height: 56,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  pressed: { opacity: 0.85 },
});