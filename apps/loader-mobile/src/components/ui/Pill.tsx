// src/components/ui/Pill.tsx
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../../theme/loaderTokens';

export type PillTone = 'green' | 'red' | 'amber' | 'blue' | 'neutral' | 'cyan' | 'navy';

const tones: Record<PillTone, { bg: string; fg: string }> = {
  green: { bg: t.greenBg, fg: t.green },
  red: { bg: t.redBg, fg: t.red },
  amber: { bg: t.amberBg, fg: t.amber },
  blue: { bg: t.blueBg, fg: t.blue },
  neutral: { bg: '#F1F5F9', fg: '#475569' },
  cyan: { bg: 'rgba(34,211,238,0.14)', fg: t.cyan },
  navy: { bg: '#1E293B', fg: '#CBD5E1' },
};

type Props = {
  label: string;
  tone?: PillTone;
  icon?: keyof typeof Ionicons.glyphMap;
  solid?: boolean; // filled strong colour, e.g. "SEVERE"
};

export function Pill({ label, tone = 'neutral', icon, solid }: Props) {
  const c = tones[tone];
  const bg = solid ? c.fg : c.bg;
  const fg = solid ? '#fff' : c.fg;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});