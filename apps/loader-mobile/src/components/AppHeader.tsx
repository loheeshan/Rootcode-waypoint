import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../theme/loaderTokens';

type Props = {
  role: string;
  location: string;
  hasAlerts?: boolean;
};

export function AppHeader({ role, location, hasAlerts }: Props) {
  const router = useRouter();
  const go = (path: string) => router.navigate(path as never);

  return (
    <View style={styles.wrap}>
      {/* Brand + location */}
      <Pressable style={styles.brand} onPress={() => go('/tabs/today')}>
        <View style={styles.logo}>
          <Ionicons name="location" size={22} color="#fff" />
        </View>
        <View style={{ flexShrink: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Waypoint</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{role}</Text>
            </View>
          </View>
          <View style={styles.locRow}>
            <View style={styles.dot} />
            <Text style={styles.loc} numberOfLines={1}>
              {location}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#64748B" />
          </View>
        </View>
      </Pressable>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Vehicle and dock details"
          style={styles.iconBtn}
          onPress={() => go('/tabs/vehicle')}
        >
          <Ionicons name="bus-outline" size={20} color={t.text} />
        </Pressable>

        <Pressable
          accessibilityLabel="Notifications"
          style={styles.iconBtn}
          onPress={() => go('/tabs/notifications')}
        >
          <Ionicons name="notifications-outline" size={20} color={t.text} />
          {hasAlerts ? <View style={styles.alertDot} /> : null}
        </Pressable>

        <Pressable
          accessibilityLabel="Profile"
          style={[styles.iconBtn, styles.avatar]}
          onPress={() => go('/tabs/profile')}
        >
          <Ionicons name="person-outline" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F4F7FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  logo: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: t.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 18, fontWeight: '800', color: t.text },
  roleBadge: {
    backgroundColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  roleText: { fontSize: 10, fontWeight: '800', color: '#475569', letterSpacing: 0.5 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  loc: { fontSize: 12, color: '#475569', flexShrink: 1, maxWidth: 130 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
  },
  avatar: { backgroundColor: t.navy, borderColor: t.navy, borderRadius: 20 },
  alertDot: {
    position: 'absolute', top: 7, right: 8, width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#fff',
  },
});