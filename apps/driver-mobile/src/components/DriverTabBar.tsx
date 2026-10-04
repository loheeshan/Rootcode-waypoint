import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '../theme/tokens';

const TABS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  today: { label: 'Today', icon: 'bus-outline' },
  stops: { label: 'Stops', icon: 'trail-sign-outline' },
  sync: { label: 'Sync', icon: 'sync-outline' },
  profile: { label: 'Profile', icon: 'person-outline' },
};

export function DriverTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabSlot}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.tab, focused && styles.tabActive]}>
              <Ionicons name={tab.icon} size={22} color={focused ? '#FFFFFF' : colors.onNavyMuted} />
              <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.navyDark,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  tabSlot: { flex: 1, alignItems: 'center' },
  tab: {
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary },
  label: { fontSize: 12, fontWeight: '600', color: colors.onNavyMuted, marginTop: 4 },
  labelActive: { color: '#FFFFFF' },
});