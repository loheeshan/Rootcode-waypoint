import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';

interface ProgressBarProps {
  /** 0 to 1. */
  value: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, color = colors.blue, height = 10 }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[s.track, { height, borderRadius: height / 2 }]}
    >
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const s = StyleSheet.create({
  track: { backgroundColor: '#DCE3F2', overflow: 'hidden' },
});