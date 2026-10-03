import { Tabs } from "expo-router";
import { AppTabBar } from "../../src/components/AppTabBar";
import { DriverTabBar } from "../../src/components/DriverTabBar";

// Screens that use the OLD AppTabBar. All others use DriverTabBar.
const APP_TAB_ROUTES = ["sync"];

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="today"
      tabBar={(props) => {
        const current = props.state.routes[props.state.index]?.name;
        return APP_TAB_ROUTES.includes(current) ? (
          <AppTabBar {...props} />
        ) : (
          <DriverTabBar {...(props as any)} />
        );
      }}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="stops" options={{ title: "Stops" }} />
      <Tabs.Screen name="sync" options={{ title: "Sync" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="could-not-deliver" options={{ href: null }} />
      <Tabs.Screen name="could-not-deliver-offline" options={{ href: null }} />
      <Tabs.Screen name="record-delivery" options={{ href: null }} />
      <Tabs.Screen name="next-stop" options={{ href: null }} />
      <Tabs.Screen name="trip-ready" options={{ href: null }} />
      <Tabs.Screen name="trip-complete" options={{ href: null }} />
      <Tabs.Screen name="trip-records" options={{ href: null }} />
      <Tabs.Screen name="sync-complete" options={{ href: null }} />
      <Tabs.Screen name="route-conflict" options={{ href: null }} />
      <Tabs.Screen name="photo-attention" options={{ href: null }} />
      <Tabs.Screen name="next-stop-after-save" options={{ href: null }} />
      <Tabs.Screen name="next-stop-last" options={{ href: null }} />
      <Tabs.Screen name="next-stop-departed" options={{ href: null }} />
      <Tabs.Screen name="next-stop-second" options={{ href: null }} />
      <Tabs.Screen name="next-stop-closed" options={{ href: null }} />
      <Tabs.Screen name="trip-revision" options={{ href: null }} />
      <Tabs.Screen name="today-reefer-fault" options={{ href: null }} />
    </Tabs>
  );
}