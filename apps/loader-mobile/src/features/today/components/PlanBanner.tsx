import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../../../theme/colors';
import type { LivePlan } from '../types';

export function PlanBanner({ plan }: { plan: LivePlan }) {
  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View style={s.liveRow}>
          <View style={s.liveDot} />
          <Text style={s.live}>LIVE PLAN</Text>
        </View>
        <Text style={s.rev}>
          Rev {plan.revision} · {plan.updatedAt}
        </Text>
      </View>

      <View style={s.divider} />

      <View style={s.bottomRow}>
        <View style={s.col}>
          <Text style={s.label}>LOADING FACILITY</Text>
          <Text style={s.value} numberOfLines={2}>
            {plan.facility}
          </Text>
        </View>
        <View style={[s.col, s.right]}>
          <Text style={s.label}>ACTIVE DOCK</Text>
          <Text style={s.value}>{plan.activeDocks}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.ink, borderRadius: radius.xl, padding: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#35D07F' },
  live: { color: '#35D07F', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  rev: { color: colors.onDarkMuted, fontSize: 12 },
  divider: { height: 1, backgroundColor: '#243056', marginVertical: 14 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  col: { flex: 1 },
  right: { alignItems: 'flex-end' },
  label: { color: colors.onDarkMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  value: { color: colors.onDark, fontSize: 18, fontWeight: '800', marginTop: 4 },
});
