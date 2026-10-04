import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { permissionColors } from '../theme/permissionColors';

type Tone = 'warning' | 'error';

type Props = {
  title: string;
  message: string;
  /** 'warning' (amber) is the default; 'error' is red. */
  tone?: Tone;
};

const TONES: Record<Tone, { background: string; title: string }> = {
  warning: {
    background: permissionColors.warningBackground,
    title: permissionColors.warningTitle,
  },
  error: {
    background: permissionColors.errorBackground,
    title: permissionColors.errorTitle,
  },
};

export function WarningCard({ title, message, tone = 'warning' }: Props) {
  const palette = TONES[tone];
  return (
    <View
      style={[styles.card, { backgroundColor: palette.background }]}
      accessibilityRole="alert"
    >
      <Text style={[styles.title, { color: palette.title }]}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: permissionColors.warningText,
  },
});