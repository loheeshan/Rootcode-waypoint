import { Tabs } from "expo-router";
import { AppTabBar } from "../../src/components/AppTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="sync"
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="stops" />
      <Tabs.Screen name="sync" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}