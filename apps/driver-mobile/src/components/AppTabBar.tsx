import type { ComponentProps } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { S } from "../theme/syncColors";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  today: { label: "Today", icon: "truck-outline" },
  stops: { label: "Stops", icon: "routes" },
  sync: { label: "Sync", icon: "sync" },
  profile: { label: "Profile", icon: "account-outline" },
};

const STOPS_CHILDREN = [
  "next-stop",
  "next-stop-closed",
  "next-stop-after-save",
  "next-stop-last",
  "trip-revision",
  "record-delivery",
  "could-not-deliver",
  "could-not-deliver-offline",
];
const TODAY_CHILDREN = ["today-reefer-fault"];

export function AppTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const pendingCount = 1;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const routeFocused = state.index === index;
        const activeName = state.routes[state.index].name;
        const focused =
          activeName === route.name ||
          (route.name === "stops" && STOPS_CHILDREN.includes(activeName)) ||
          (route.name === "today" && TODAY_CHILDREN.includes(activeName));
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!routeFocused && !event.defaultPrevented) {
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
              <View>
                <MaterialCommunityIcons
                  name={tab.icon}
                  size={22}
                  color={focused ? "#fff" : "#8C97C4"}
                />
                {route.name === "sync" && pendingCount > 0 && !focused ? (
                  <View style={styles.badgeDot} />
                ) : null}
              </View>
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
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: S.amber,
  },
});