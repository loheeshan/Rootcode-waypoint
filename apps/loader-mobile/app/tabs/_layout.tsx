// shared header + tab bar
import { Tabs } from 'expo-router';

import { AppHeader } from '../../src/components/AppHeader';
import { AppTabBar } from '../../src/components/AppTabBar';
import { LoadingProvider } from '../../src/features/loading/LoadingProvider';
import { shortId } from '../../src/features/loading/format';
import { useAuth } from '../../src/services/auth';

/**
 * Routes that are not tabs. The value is the tab that should look selected
 * while that screen is open (null = none).
 */
const SUB_SCREENS: Record<string, string | null> = {
  vehicle: 'today',
  'no-plan': 'today',
  'kandy-remote': 'today',
  'staging-issue': 'report',
  'trip-checklist': 'checklist',
  manifest: 'depart',
  'signoff-saved': 'depart',
  'vehicle-ready': 'depart',
  'issue-resolved': 'depart',
  'dispatcher-pending': 'depart',
  'departure-checks': 'depart',
  profile: null,
  settings: null,
  notifications: null,
  synced: null,
  'sync-queue': null,
  'session-expired': null,
};

/** Header location comes from the signed-in account, not static text. */
function LoaderHeader() {
  const { user } = useAuth();
  const depots = user?.depot_ids ?? [];
  const location = depots.length ? `Depot ${depots.map(shortId).join(', ')}` : user?.email ?? 'Loader';
  return <AppHeader role="LOADER" location={location} />;
}

export default function TabsLayout() {
  return (
    <LoadingProvider>
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
        header: () => <LoaderHeader />,
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="checklist" options={{ title: 'Checklist' }} />
      <Tabs.Screen name="report" options={{ title: 'Report' }} />
      <Tabs.Screen name="depart" options={{ title: 'Depart' }} />

      {Object.keys(SUB_SCREENS).map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
    </LoadingProvider>
  );
}