import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../../theme/colors';

interface AlertCalloutProps {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** Amber notice box: plan updated, shortfall warning, etc. */
export function AlertCallout({ title, message, icon = 'warning-outline' }: AlertCalloutProps) {
  return (
    <View style={s.box} accessibilityRole="alert">
      <Ionicons name={icon} size={20} color={colors.amber} />
      <View style={s.body}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.message}>{message}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberBorder,
  },
  body: { flex: 1 },
  title: { color: colors.amber, fontSize: 14, fontWeight: '800' },
  message: { color: colors.amber, fontSize: 13, marginTop: 2 },
});