import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../../theme/colors';

interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  /** Icon shown after the label. */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, trailingIcon, disabled }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.btn, (pressed || disabled) && { opacity: 0.8 }]}
    >
      <Text style={s.text}>{label}</Text>
      {trailingIcon ? <Ionicons name={trailingIcon} size={20} color={colors.onDark} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: { color: colors.onDark, fontSize: 16, fontWeight: '700' },
});