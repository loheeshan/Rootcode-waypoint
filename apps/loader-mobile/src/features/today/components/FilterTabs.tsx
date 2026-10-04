import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../../../theme/colors';

export interface FilterOption<T extends string> {
  key: T;
  label: string;
  count: number;
}

interface FilterTabsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (key: T) => void;
}

/** Horizontal filter pills with counts. Selected pill is filled dark. */
export function FilterTabs<T extends string>({ options, value, onChange }: FilterTabsProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${o.label}, ${o.count}`}
            style={[s.pill, active ? s.pillActive : s.pillIdle]}
          >
            <Text style={[s.label, active && s.labelActive]}>{o.label}</Text>
            <View style={[s.count, active && s.countActive]}>
              <Text style={[s.countText, active && s.countTextActive]}>{o.count}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  pillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  label: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  labelActive: { color: colors.onDark },
  count: { minWidth: 20, alignItems: 'center' },
  countActive: {},
  countText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  countTextActive: { color: colors.onDark },
});