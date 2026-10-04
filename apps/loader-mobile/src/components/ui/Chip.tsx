import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../../theme/colors';

export type ChipTone = 'neutral' | 'green' | 'blue' | 'violet';

const TONES: Record<ChipTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: '#EEF1F6', fg: colors.inkSoft, border: colors.border },
  green: { bg: colors.greenSoft, fg: colors.green, border: colors.greenBorder },
  blue: { bg: colors.blueSoft, fg: colors.blue, border: colors.blueBorder },
  violet: { bg: colors.violetSoft, fg: colors.violet, border: '#C9BCF7' },
};

interface ChipProps {
  label: string;
  tone?: ChipTone;
  /** Small coloured dot before the label. */
  dot?: boolean;
}

/** Small read-only pill: category, vehicle type, route. */
export function Chip({ label, tone = 'neutral', dot = false }: ChipProps) {
  const t = TONES[tone];
  return (
    <View style={[s.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
      {dot ? <View style={[s.dot, { backgroundColor: t.fg }]} /> : null}
      <Text style={[s.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '600' },
});