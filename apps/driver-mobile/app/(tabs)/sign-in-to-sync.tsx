import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { WarningCard } from '../../src/components/WarningCard';
import { colors, radius, spacing } from '../../src/theme/tokens';

export default function SignInToSyncScreen() {
  const router = useRouter();

  // TODO: replace with the real vehicle/depot from Expo SQLite.
  const vehicleLabel = 'VEH018 · Colombo Fresh';

  const handleSignInAgain = () => {
    // Offline rule from Driver-architecture.md: local records stay in SQLite.
    // Only the expired session token is replaced after a successful sign-in.
    // TODO(feature/driver-api-integration): after sign-in succeeds, send the queued outbox events.
    router.replace('/login');
  };

  const handleViewSavedWork = () => {
    router.push('/trip-records');
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <AppHeader subtitle={vehicleLabel} syncStatus="offline-saved" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Sign in to sync</Text>

        <WarningCard
          title="Your local records are kept"
          message="Your session expired. Re-authenticate when connected before sending queued records."
        />

        <Pressable
          onPress={handleSignInAgain}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Sign in again</Text>
        </Pressable>

        <Pressable
          onPress={handleViewSavedWork}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>View saved work</Text>
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