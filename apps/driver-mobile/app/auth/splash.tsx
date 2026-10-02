import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';
import { colors, spacing, radius } from '../../src/theme/colors';

export default function FirstLaunchOfflineScreen() {
  const [checking, setChecking] = useState(false);

  const handleRetry = useCallback(async () => {
    setChecking(true);
    const state = await NetInfo.fetch();
    setChecking(false);
    if (state.isConnected) {
      router.replace('/(auth)/sign-in');
    }
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.coords}>SYS.LOC // 6.9271° N{'\n'}79.8612° E</Text>

      <View style={styles.logoWrap}>
        <View style={styles.logoBox} />
      </View>

      <Text style={styles.brand}>Waypoint</Text>
      <Text style={styles.brandSub}>— DRIVER LOGISTICS OS —</Text>
      <Text style={styles.tagline}>Smarter Deliveries. Stronger Tomorrow.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Internet Connection Required</Text>
        <Text style={styles.cardBody}>
          No connection detected. First-time sign-in requires an active internet
          connection to download local route manifest and authenticate.
        </Text>
        <Pressable style={styles.retryButton} onPress={handleRetry} disabled={checking}>
          {checking ? <ActivityIndicator color={colors.white} /> : <Text style={styles.retryText}>↻  Retry Connection</Text>}
        </Pressable>
        <Text style={styles.footnote}>✓ Once signed in, you'll be able to work offline.</Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusText}>● Awaiting network handshake...</Text>
        <Text style={styles.statusText}>0%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.cacheRow}>
        <Text style={styles.cacheText}>CACHE: NO CREDENTIALS FOUND</Text>
        <Text style={styles.cacheText}>LOCAL STORE READY</Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>+ Sri Lanka Fleet Network</Text>
        <Text style={styles.footerText}>v2.4.0 (Build 884)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: 60 },
  coords: { color: colors.textMuted, fontSize: 10, textAlign: 'right' },
  logoWrap: { alignItems: 'center', marginTop: spacing.lg },
  logoBox: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  brand: { color: colors.white, fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: spacing.md },
  brandSub: { color: '#4FD1C5', fontSize: 11, fontWeight: '700', letterSpacing: 2, textAlign: 'center', marginTop: 4 },
  tagline: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cardTitle: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  cardBody: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryButton: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md, width: '100%', alignItems: 'center' },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  footnote: { color: colors.success, fontSize: 12, marginTop: spacing.md },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl },
  statusText: { color: colors.textMuted, fontSize: 11 },
  progressTrack: { height: 3, backgroundColor: colors.border, borderRadius: 2, marginTop: spacing.xs, overflow: 'hidden' },
  progressFill: { width: '4%', height: '100%', backgroundColor: colors.primary },
  cacheRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  cacheText: { color: colors.textMuted, fontSize: 10 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl, paddingBottom: spacing.lg },
  footerText: { color: colors.textMuted, fontSize: 10 },
});