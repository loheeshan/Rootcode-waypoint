import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '../../theme/loaderTokens';

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  );
}

const noticeTones = {
  green: { bg: '#ECFDF3', border: '#BBF7D0', title: '#15803D', body: '#14532D' },
  amber: { bg: '#FFFBEB', border: '#FDE68A', title: '#C2410C', body: '#78350F' },
  red: { bg: '#FEF2F2', border: '#FECACA', title: '#DC2626', body: '#7F1D1D' },
  blue: { bg: '#EFF4FF', border: '#DCE6FB', title: '#2563EB', body: '#0F172A' },
} as const;

export function Notice({
  tone,
  title,
  children,
}: {
  tone: keyof typeof noticeTones;
  title: string;
  children: ReactNode;
}) {
  const c = noticeTones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.noticeTitle, { color: c.title }]}>{title}</Text>
      <Text style={[styles.noticeBody, { color: c.body }]}>{children}</Text>
    </View>
  );
}

const lineColors = { muted: '#64748B', dark: t.text, success: t.green } as const;

type InfoCardProps = {
  title: string;
  lines?: string[];
  note?: string;
  linesTone?: keyof typeof lineColors;
  compact?: boolean;
  onPress?: () => void;
};

export function InfoCard({ title, lines = [], note, linesTone = 'muted', compact, onPress }: InfoCardProps) {
  const body = (
    <View style={styles.card}>
      <Text style={[styles.cardTitle, compact && styles.cardTitleCompact]}>{title}</Text>
      {lines.map((line) => (
        <Text key={line} style={[styles.line, { color: lineColors[linesTone] }]}>
          {line}
        </Text>
      ))}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  small,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  small?: boolean;
  disabled?: boolean;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.buttonText, primary && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: t.text, marginTop: 4 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  noticeTitle: { fontSize: 15, fontWeight: '800' },
  noticeBody: { fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
    borderRadius: 16, padding: 16, gap: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: t.text, marginBottom: 4 },
  cardTitleCompact: { fontSize: 16 },
  line: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 6 },
  button: { borderRadius: 14, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { paddingVertical: 13 },
  buttonPrimary: { backgroundColor: t.blue },
  buttonSecondary: { backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
  buttonText: { fontSize: 16, fontWeight: '800', color: t.text },
});