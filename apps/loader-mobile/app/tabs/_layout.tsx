// shared header + tab bar
import { Tabs } from 'expo-router';

/**
 * Routes that are not tabs. The value is the tab that should look selected
 * while that screen is open (null = none).
 */
const SUB_SCREENS: Record<string, string | null> = {
  vehicle: 'today',
  profile: null,
  settings: null,
  notifications: null,
  synced: null,
  'sync-queue': null,
  'signoff-saved': 'depart',
  'vehicle-ready': 'depart',
  'issue-resolved': 'depart',
  'dispatcher-pending': 'depart',
  'departure-checks': 'depart',
};

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="today"
      tabBar={(props) => {
        const routes = props.state.routes.filter((r) => !(r.name in SUB_SCREENS));
        const current = props.state.routes[props.state.index]?.name;
        const active = current !== undefined && current in SUB_SCREENS ? SUB_SCREENS[current] : current;
        const index = routes.findIndex((r) => r.name === active);
        return <AppTabBar {...props} state={{ ...props.state, routes, index }} />;
      }}
      screenOptions={{
        header: () => (
          <AppHeader role="LOADER" location="Peliyagoda · Route Colombo" hasAlerts />
        ),
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="checklist" options={{ title: 'Checklist' }} />
      <Tabs.Screen name="report" options={{ title: 'Report' }} />
      <Tabs.Screen name="depart" options={{ title: 'Depart' }} />

      <Tabs.Screen name="vehicle" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="synced" options={{ href: null }} />
      <Tabs.Screen name="sync-queue" options={{ href: null }} />
      <Tabs.Screen name="signoff-saved" options={{ href: null }} />
      <Tabs.Screen name="vehicle-ready" options={{ href: null }} />
      <Tabs.Screen name="issue-resolved" options={{ href: null }} />
      <Tabs.Screen name="dispatcher-pending" options={{ href: null }} />
      <Tabs.Screen name="departure-checks" options={{ href: null }} />
    </Tabs>
  );
}