// shared header + tab bar
import { Tabs } from 'expo-router';

import { AppHeader } from '../../src/components/AppHeader';
import { AppTabBar } from '../../src/components/AppTabBar';

/**
 * Every loader tab shares the same header and bottom bar.
 * To change either, edit the component, not each screen.
 */
export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="today"
      tabBar={(props) => <AppTabBar {...props} />}
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
    </Tabs>
  );
}