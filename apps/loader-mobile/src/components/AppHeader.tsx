import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../theme/colors';

interface AppHeaderProps {
  /** Small badge next to the brand, e.g. "LOADER". */
  role: string;
  /** Line under the brand, e.g. "Peliyagoda · Route Colombo". */
  location: string;
  /** Shows the red dot on the bell. */
  hasAlerts?: boolean;
  onPressVehicle?: () => void;
  onPressAlerts?: () => void;
  onPressProfile?: () => void;
}

/** Shared top bar. Used by every loader tab through the tabs layout `header` option. */
export function AppHeader({
  role,
  location,
  hasAlerts = false,
  onPressVehicle,
  onPressAlerts,
  onPressProfile,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.logo}>
        <Ionicons name="location" size={22} color={colors.onDark} />
      </View>

      <View style={s.brandBlock}>
        <View style={s.brandRow}>
          <Text style={s.brand}>Waypoint</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{role}</Text>
          </View>
        </View>
        <View style={s.locationRow}>
          <View style={s.dot} />
          <Text style={s.location} numberOfLines={1}>
            {location}
          </Text>
        </View>
      </View>

      <View style={s.actions}>
        <IconButton icon="bus-outline" label="Vehicle" onPress={onPressVehicle} />
        <IconButton icon="notifications-outline" label="Alerts" onPress={onPressAlerts} badge={hasAlerts} />
        <Pressable
          onPress={onPressProfile}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          style={s.avatar}
        >
          <Ionicons name="person-outline" size={20} color={colors.onDark} />
        </Pressable>
      </View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  badge?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.iconBtn}>
      <Ionicons name={icon} size={20} color={colors.ink} />
      {badge ? <View style={s.badge} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.bg,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBlock: { flex: 1, minWidth: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  roleBadge: {
    backgroundColor: '#E3E7F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  location: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.red,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});