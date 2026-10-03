import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../theme/colors';

export interface TabItem {
  /** Route file name inside app/(tabs), e.g. "today". */
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** The four loader tabs. Add a tab here and create its file in app/(tabs). */
export const LOADER_TABS: TabItem[] = [
  { name: 'today', label: 'Today', icon: 'grid-outline' },
  { name: 'checklist', label: 'Checklist', icon: 'clipboard-outline' },
  { name: 'report', label: 'Report', icon: 'warning-outline' },
  { name: 'depart', label: 'Depart', icon: 'arrow-forward-circle-outline' },
];

/**
 * Structural subset of the props expo-router passes to a custom `tabBar`.
 * Typed locally so this component does not depend on @react-navigation packages.
 */
interface AppTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (...args: any[]) => void };
  items?: TabItem[];
}

/** Shared bottom navigation. Plug in with <Tabs tabBar={(p) => <AppTabBar {...p} />} />. */
export function AppTabBar({ state, navigation, items = LOADER_TABS }: AppTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;

  return (
    <View style={[s.root, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item) => {
        const active = item.name === activeName;
        return (
          <Pressable
            key={item.name}
            onPress={() => navigation.navigate(item.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            style={s.tabSlot}
          >
            <View style={[s.tab, active && s.tabActive]}>
              <Ionicons name={item.icon} size={22} color={active ? colors.blue : colors.muted} />
              <Text style={[s.label, active && s.labelActive]}>{item.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tabSlot: { flex: 1, alignItems: 'center' },
  tab: {
    minWidth: 76,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  tabActive: { backgroundColor: colors.blueSoft },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  labelActive: { color: colors.blue, fontWeight: '700' },
});