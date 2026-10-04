import NetInfo from '@react-native-community/netinfo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { ActionButton, InfoCard, Notice, Screen } from '../../components/ui/ScreenKit';
import { t } from '../../theme/loaderTokens';

function useGo() {
  const router = useRouter();
  return (pathname: string, params?: Record<string, string>) =>
    router.navigate((params ? { pathname, params } : pathname) as never);
}

/** Screen that shows the header but no tab bar (used outside the tabs). */
function Standalone({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <AppHeader role="LOADER" location="Peliyagoda · Route Colombo" hasAlerts />
      <Screen title={title}>{children}</Screen>
    </View>
  );
}

/* ---------- Outside the tabs ---------- */
export function WelcomeScreen() {
  const go = useGo();
  return (
    <Standalone title="Waypoint Loader">
      <InfoCard
        title="Ready for the next departure"
        lines={['Live loading plans · reverse stop sequence', 'Fast issue reporting · offline protection']}
      />
      <ActionButton label="Start shift" onPress={() => go('/start-shift')} />
    </Standalone>
  );
}

export function StartShiftScreen() {
  const go = useGo();
  return (
    <Standalone title="Start your loading shift">
      <InfoCard
        title="Peliyagoda Central Depot"
        lines={['Shared dock device · Bay B-04', 'Select your bay-lead account to continue.']}
      />
      <ActionButton label="K. Bandara · Bay lead #04" onPress={() => go('/tabs/today')} />
      <ActionButton variant="secondary" label="Choose another depot" onPress={() => {}} />
      <ActionButton variant="secondary" label="Can’t sign in?" onPress={() => {}} />
    </Standalone>
  );
}

/* ---------- Inside the tabs ---------- */
export function SessionExpiredScreen() {
  const go = useGo();
  return (
    <Screen title="Session expired">
      <Notice tone="amber" title="Local records are kept">
        Sign in again to send queued work. Nothing saved on this device is discarded.
      </Notice>
      <ActionButton label="Sign in again" onPress={() => go('/start-shift')} />
      <ActionButton variant="secondary" label="View saved records" onPress={() => go('/tabs/sync-queue')} />
    </Screen>
  );
}

export function NoPlanScreen() {
  const go = useGo();
  const [checking, setChecking] = useState(false);

  const retry = async () => {
    setChecking(true);
    const state = await NetInfo.fetch();
    setChecking(false);
    if (state.isConnected && state.isInternetReachable !== false) go('/tabs/today');
  };

  return (
    <Screen title="No saved plan available">
      <Notice tone="amber" title="Connect before loading">
        This device has no downloaded plan for this depot. Loading checks are unavailable until the current plan is
        received.
      </Notice>
      <ActionButton label={checking ? 'Checking…' : 'Retry connection'} onPress={retry} />
      <ActionButton variant="secondary" label="Choose depot" onPress={() => go('/start-shift')} />
    </Screen>
  );
}

export function KandyRemoteScreen() {
  const go = useGo();
  return (
    <Screen title="Kandy depot · remote view">
      <Notice tone="blue" title="Remote coverage confirmed">
        You can review Kandy’s plan. Physical loading and sign-off must be completed by the crew at that dock.
      </Notice>
      <InfoCard
        title="VEH041 · Kandy Fresh"
        lines={['Bay K-02 · departure 04:10', '5 of 6 orders loaded · local crew loading']}
      />
      <ActionButton label="Contact Kandy bay lead" onPress={() => {}} />
      <ActionButton variant="secondary" label="Switch to Peliyagoda" onPress={() => go('/tabs/today')} />
    </Screen>
  );
}

export function StagingIssueScreen() {
  const go = useGo();
  return (
    <Screen title="VEH031 · Staging issue">
      <Notice tone="amber" title="2 items missing">
        Stop 2 · staging zone C-12 · Tech trip departs 05:00
      </Notice>
      <InfoCard
        title="Recheck staging"
        lines={['Check adjacent cage labels and the dispatch manifest before reporting the available quantity.']}
      />
      <ActionButton label="Found both items" onPress={() => go('/tabs/today', { filter: 'Tech' })} />
      <ActionButton variant="secondary" label="Still missing · notify dispatcher" onPress={() => go('/tabs/report')} />
      <ActionButton variant="secondary" label="Back to Tech trips" onPress={() => go('/tabs/today', { filter: 'Tech' })} />
    </Screen>
  );
}

/* ---------- Signed manifest (VEH018 and VEH009) ---------- */
export function ManifestScreen() {
  const go = useGo();
  const { id } = useLocalSearchParams<{ id?: string }>();

  if (id === 'VEH009') {
    return (
      <Screen title="VEH009 · Signed manifest">
        <Notice tone="green" title="Style · Trip 1 · ready">
          4 of 4 orders loaded · K. Perera staged
        </Notice>
        <InfoCard
          title="Departure 04:45"
          lines={['Ambient 14ft · Peliyagoda', 'Cargo inspected and sealed', '4 stops confirmed · ready for handoff']}
        />
        <ActionButton label="Back to Style trips" onPress={() => go('/tabs/today', { filter: 'Style' })} />
      </Screen>
    );
  }

  return (
    <Screen title="Signed manifest">
      <Notice tone="green" title="VEH018 · Trip 1 · ready">
        Plan rev 3.1 · signed by K. Bandara at 03:29
      </Notice>
      <InfoCard
        title="Load sequence · deepest to door"
        lines={[
          'Stop 7 · OUT081 · 18 cartons',
          'Stop 6 · OUT065 · 14 cartons',
          'Stop 5 · OUT052 · 22 cartons',
          'Stop 4 · OUT039 · 16 cartons',
          'Stop 3 · OUT027 · 8 of 10 crates',
          'Stop 2 · OUT014 · 20 cartons',
          'Stop 1 · OUT001 · 12 cartons',
        ]}
      />
      <InfoCard title="Inspection record" lines={['Cargo secured · +4°C verified', 'Seal SL-99420 · all checks passed']} />
      <ActionButton label="Back to today" onPress={() => go('/tabs/today')} />
    </Screen>
  );
}

/* ---------- VEH022 trip checklist ---------- */
const trip2Orders = [
  { load: 1, stop: 6, title: 'OUT096 · Colombo Fresh' },
  { load: 2, stop: 5, title: 'OUT095 · Colombo Fresh' },
  { load: 3, stop: 4, title: 'OUT044 · reassigned order' },
  { load: 4, stop: 3, title: 'OUT088 · Colombo Fresh' },
  { load: 5, stop: 2, title: 'OUT087 · Colombo Fresh' },
  { load: 6, stop: 1, title: 'OUT086 · Colombo Fresh' },
];

export function TripChecklistScreen() {
  const [done, setDone] = useState<boolean[]>(trip2Orders.map(() => false));
  const count = done.filter(Boolean).length;
  const toggle = (i: number) => setDone((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  return (
    <Screen title="VEH022 · Trip 2">
      <Notice tone="amber" title="Updated · Plan rev 3">
        ORD0092350 / OUT044 was reassigned from VEH018. Verify the staging unit before loading.
      </Notice>
      <InfoCard
        title="Fresh · Chilled van"
        lines={['Bay B-07 · departure 04:15', '6 delivery stops · load last stop first']}
      />
      <Text style={styles.count}>
        {count} of {trip2Orders.length} orders loaded
      </Text>

      {trip2Orders.map((o, i) => (
        <Pressable
          key={o.title}
          onPress={() => toggle(i)}
          style={[styles.order, done[i] && styles.orderDone]}
        >
          <Text style={styles.orderLabel}>
            LOAD {o.load} · STOP {o.stop}
          </Text>
          <Text style={styles.orderTitle}>{o.title}</Text>
          <Text style={styles.orderNote}>Chilled cartons · verify manifest</Text>
          <Text style={[styles.orderAction, done[i] && { color: t.green }]}>
            {done[i] ? '✓ Loaded · tap to undo' : 'Tap to confirm loaded'}
          </Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 16, fontWeight: '800', color: t.blue },
  order: {
    backgroundColor: '#EFF4FF', borderWidth: 1.5, borderColor: t.blue,
    borderRadius: 16, padding: 16, gap: 4,
  },
  orderDone: { backgroundColor: t.greenSoft, borderColor: '#86EFAC' },
  orderLabel: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 0.4 },
  orderTitle: { fontSize: 18, fontWeight: '800', color: t.text, marginTop: 2 },
  orderNote: { fontSize: 14, color: '#64748B' },
  orderAction: { fontSize: 14, fontWeight: '800', color: t.blue, marginTop: 6 },
});