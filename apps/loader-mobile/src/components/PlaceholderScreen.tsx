import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

/** Stand-in for tabs that are not built yet. Replace the route file when the real screen lands. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={s.root}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.sub}>This screen is not built yet.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 14, marginTop: 6 },
});