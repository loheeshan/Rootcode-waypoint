import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { useIsOffline } from '../../hooks/useIsOffline';
import { useAuth } from '../../services/auth';
import { useSync } from '../../sync/SyncProvider';
import { colors, radius, spacing } from '../../theme/tokens';

/** Driver screen shell: header with the signed-in account and live connectivity, pull to refresh. */
export function DriverScreen({ title, subtitle, refreshing = false, onRefresh, children }: {
  title: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const offline = useIsOffline();
  const { counts, running, stopped, syncNow } = useSync();
  const waiting = counts.pending + counts.syncing;
  return (
    <View style={styles.screen}>
      {/* Online mode has no local queue, so "synced" only means nothing is waiting on this phone. */}
      <AppHeader subtitle={subtitle ?? user?.email ?? 'Driver'} syncStatus={offline ? (waiting ? 'offline-saved' : 'offline') : waiting ? 'pending' : 'synced'} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {offline ? (
          <Notice tone="amber" title="No connection">Actions are saved on this phone and sent automatically when you are back online.</Notice>
        ) : null}
        {waiting && !offline ? (
          <Notice tone="blue" title={running ? `Sending ${waiting} change${waiting === 1 ? '' : 's'}…` : `${waiting} change${waiting === 1 ? '' : 's'} waiting to sync`}>
            {stopped === 'unauthorized' ? 'Sign in again to send them.' : stopped === 'forbidden' ? 'This account no longer has Driver access for this work.' : 'Saved on this phone. Not yet confirmed by the server.'}
          </Notice>
        ) : null}
        {waiting && !offline && !running && stopped !== 'unauthorized' && stopped !== 'forbidden' ? <Button variant="outline" label="Sync now" onPress={syncNow} /> : null}
        {counts.failed ? (
          <Notice tone="red" title={`${counts.failed} change${counts.failed === 1 ? '' : 's'} not applied`}>Open the trip on Stops to review.</Notice>
        ) : null}
        {children}
      </ScrollView>
    </View>
  );
}

const TONES = {
  blue: { bg: '#E8EEFC', fg: colors.primary },
  green: { bg: colors.successBg, fg: colors.successText },
  amber: { bg: colors.warningBg, fg: colors.warningText },
  red: { bg: colors.dangerBg, fg: colors.dangerText },
};

export function Notice({ tone, title, children }: { tone: keyof typeof TONES; title: string; children?: ReactNode }) {
  const palette = TONES[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]} accessibilityRole={tone === 'red' ? 'alert' : undefined}>
      <Text style={[styles.noticeTitle, { color: palette.fg }]}>{title}</Text>
      {children ? <Text style={styles.noticeBody}>{children}</Text> : null}
    </View>
  );
}

export function Card({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return <View style={[styles.card, selected && styles.cardSelected]}>{children}</View>;
}

const VARIANTS = {
  primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
  outline: { bg: colors.surface, fg: colors.textPrimary, border: colors.border },
  danger: { bg: colors.dangerText, fg: '#FFFFFF', border: colors.dangerText },
};

/** Full-width action on the light driver screens; disabled while `loading`. */
export function Button({ label, onPress, variant = 'primary', loading, disabled }: {
  label: string;
  onPress: () => void;
  variant?: keyof typeof VARIANTS;
  loading?: boolean;
  disabled?: boolean;
}) {
  const palette = VARIANTS[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.button, { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && { opacity: 0.85 }, off && { opacity: 0.5 },
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>}
    </Pressable>
  );
}

export const text = StyleSheet.create({
  heading: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textPrimary },
  muted: { fontSize: 13, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  notice: { borderRadius: 14, padding: spacing.sm, gap: 4 },
  noticeTitle: { fontSize: 15, fontWeight: '800' },
  noticeBody: { fontSize: 14, color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: 6,
  },
  cardSelected: { borderColor: colors.primary, borderWidth: 2 },
  button: {
    minHeight: 56, borderRadius: radius.button, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
