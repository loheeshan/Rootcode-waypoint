import { View, Text, Pressable, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { S } from "../theme/syncColors";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const TABS: Record<string, { label: string; icon: IconName }> = {
  today: { label: "Today", icon: "truck-outline" },
  stops: { label: "Stops", icon: "routes" },
  sync: { label: "Sync", icon: "sync" },
  profile: { label: "Profile", icon: "account-outline" },
};

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <MaterialCommunityIcons
                name={tab.icon}
                size={22}
                color={focused ? "#fff" : "#8C97C4"}
              />
              <Text style={[styles.label, { color: focused ? "#fff" : "#8C97C4" }]}>
                {tab.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    paddingTop: 10,
    paddingHorizontal: 8,
    backgroundColor: S.tabBar,
  },
  item: { flex: 1, alignItems: "center" },
  pill: {
    minWidth: 68,
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  pillActive: { backgroundColor: S.primary },
  label: { fontSize: 11, fontWeight: "700" },
});