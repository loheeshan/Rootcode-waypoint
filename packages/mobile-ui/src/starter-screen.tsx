import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@waypoint/design-tokens';
export function StarterScreen({ role, online }: { role: string; online: boolean | null }) {
  return <ScrollView contentContainerStyle={styles.screen}>
    <Text style={styles.eyebrow}>WAYPOINT / FOUNDATION</Text>
    <Text style={styles.title}>{role}</Text>
    <Text style={styles.body}>Your workspace is ready for implementation.</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>No trips yet</Text>
      <Text style={styles.body}>Authentication and assigned trips will be connected in the next feature branches.</Text>
    </View>
    <Text accessibilityRole="text" style={styles.body}>Network: {online === null ? 'checking' : online ? 'connected' : 'offline'}</Text>
    <Text style={styles.body}>Local SQLite is initialized. Event synchronization is not connected yet.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700' },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '600', marginBottom: spacing.sm },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
});
