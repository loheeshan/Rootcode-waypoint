import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme/colors';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.base, toneStyles[tone]]}>
      <Text style={[styles.text, toneText[tone]]}>{label}</Text>
    </View>
  );
}

const toneStyles: Record<Tone, object> = {
  success: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: colors.success },
  warning: { backgroundColor: 'rgba(245,166,35,0.15)', borderColor: colors.warning },
  danger: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: colors.danger },
  neutral: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.border },
  info: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6' },
};

const toneText: Record<Tone, object> = {
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  neutral: { color: colors.textSecondary },
  info: { color: '#60A5FA' },
};

const styles = StyleSheet.create({
  base: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});