import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { WarningCard } from '../../src/components/WarningCard';
import { colors, radius, spacing } from '../../src/theme/tokens';

export default function CameraPermissionDeniedScreen() {
  const router = useRouter();

  // TODO: replace with the real vehicle/depot and sync state from Expo SQLite / the outbox.
  const vehicleLabel = 'VEH018 · Colombo Fresh';

  const handleReviewPermissions = async () => {
    try {
      // Opens this app's page in the phone's system settings.
      await Linking.openSettings();
    } catch {
      // Settings could not be opened; the screen stays so the driver can try again.
    }
  };

  const handleReturnToDelivery = () => {
    // The delivery continues without a photo (photo is optional).
    // TODO(feature/driver-sqlite, feature/driver-sync): mark the stop as "no photo"
    // locally and queue the outbox event (offline rule in Driver-architecture.md).
    if (router.canGoBack()) router.back();
    else router.replace('/record-delivery');
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* If your AppHeader uses different props, copy the call from could-not-deliver.tsx. */}
      <AppHeader subtitle={vehicleLabel} syncStatus="synced" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Camera permission denied</Text>

        <WarningCard
          title="Photo not captured"
          message="Delivery details and signature are safe. Photo is optional; continue without it or review permissions."
        />

        <Pressable
          onPress={handleReviewPermissions}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Review permissions</Text>
        </Pressable>

        <Pressable
          onPress={handleReturnToDelivery}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Return to delivery</Text>
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
