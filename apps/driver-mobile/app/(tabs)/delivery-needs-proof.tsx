import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { WarningCard } from '../../src/components/WarningCard';
import { colors, radius, spacing } from '../../src/theme/tokens';

export default function DeliveryNeedsProofScreen() {
  const router = useRouter();

  // TODO: replace with the real vehicle/depot and sync state from Expo SQLite / the outbox.
  const vehicleLabel = 'VEH018 · Colombo Fresh';

  const handleAddReceiverAndSignature = () => {
    // Quantities and arrival time are already saved locally (offline rule in
    // Driver-architecture.md); the delivery can only be completed once proof exists.
    // TODO: point this at the dedicated receiver + signature screen when it exists.
    router.replace('/record-delivery');
  };

  const handleReturnToDelivery = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/record-delivery');
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <AppHeader subtitle={vehicleLabel} syncStatus="synced" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Delivery needs proof</Text>

        <WarningCard
          tone="error"
          title="Receiver name and signature required"
          message="Add the receiver name and signature before completing this delivery. Quantities and arrival time remain saved."
        />

        <Pressable
          onPress={handleAddReceiverAndSignature}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Add receiver and signature</Text>
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