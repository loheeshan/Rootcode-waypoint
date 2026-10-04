import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ActionButton, InfoCard, Notice, Screen } from '../../components/ui/ScreenKit';
import { useIsOffline } from '../../hooks/useIsOffline';

function useGo() {
  const router = useRouter();
  return (path: string) => router.navigate(path as never);
}

/* ---------- Today tab: vehicle & dock details ---------- */
export function VehicleDetailsScreen() {
  const go = useGo();
  return (
    <Screen title="Vehicle & dock details">
      <InfoCard
        title="VEH018 · Reefer truck"
        lines={['Trip 1 · Colombo Fresh', 'Bay B-04 · departure 03:30', '1,820 kg / 14.4 m³', 'Driver: Sunil Perera']}
      />
      <Notice tone="blue" title="Cold-chain check">
        This trip’s chilled set-point is +4°C. Verify the load’s handling label and logger.
      </Notice>
      <ActionButton label="Scan vehicle / order" onPress={() => {}} />
      <ActionButton variant="secondary" label="Open load checklist" onPress={() => go('/tabs/checklist')} />
      <ActionButton variant="secondary" label="Report vehicle problem" onPress={() => go('/tabs/report')} />
    </Screen>
  );
}

/* ---------- Profile / settings / notifications ---------- */
export function ProfileScreen() {
  const go = useGo();
  const offline = useIsOffline();
  return (
    <Screen title="Loader profile">
      <InfoCard
        title="K. Bandara"
        lines={['Bay lead #04 · Peliyagoda Central Depot', 'Shift 02:30–10:30 · shared dock device']}
      />
      <ActionButton label="Settings" onPress={() => go('/tabs/settings')} />
      <ActionButton variant="secondary" label="Switch depot" onPress={() => {}} />
      <ActionButton
        variant="secondary"
        label="Sync status"
        onPress={() => go(offline ? '/tabs/sync-queue' : '/tabs/synced')}
      />
      <ActionButton variant="secondary" label="End shift and sign out" onPress={() => go('/end-shift')} />
    </Screen>
  );
}

export function SettingsScreen() {
  const go = useGo();
  return (
    <Screen title="Settings">
      <InfoCard
        title="Shared device"
        lines={['Bay B-04 · Peliyagoda', '48 px minimum tap controls', 'Keep this device at the dock.']}
      />
      <ActionButton variant="secondary" label="Language · English" onPress={() => {}} />
      <ActionButton variant="secondary" label="Camera access" onPress={() => {}} />
      <ActionButton variant="secondary" label="Notification preferences" onPress={() => {}} />
      <ActionButton variant="secondary" label="Back to profile" onPress={() => go('/tabs/profile')} />
    </Screen>
  );
}

const notifications = [
  { title: 'Plan rev 3 published', body: 'ORD0092350 moved to VEH022 · 03:10', href: '/tabs/today' },
  { title: 'Dispatch response', body: 'ORD0092322 · manifest adjustment approved · 03:14', href: '/tabs/issue-resolved' },
  { title: 'Sync attention', body: 'A locally saved update needs connection', href: '/tabs/sync-queue' },
];

export function NotificationsScreen() {
  const go = useGo();
  return (
    <Screen title="Notifications">
      {notifications.map((n) => (
        <View key={n.title} style={{ gap: 8 }}>
          <InfoCard title={n.title} lines={[n.body]} />
          <ActionButton small variant="secondary" label={`Open ${n.title}`} onPress={() => go(n.href)} />
        </View>
      ))}
    </Screen>
  );
}

/* ---------- Sync ---------- */
export function SyncedScreen() {
  const go = useGo();
  return (
    <Screen title="Everything synced">
      <Notice tone="green" title="5 updates sent once · 03:31">
        Three loading checks, one issue report and one sign-off were sent. Original capture times are kept.
      </Notice>
      <InfoCard
        title="Driver handoff delivered"
        lines={['VEH018 is ready. Trip 1 is now unlocked on the driver’s phone.']}
      />
      <Notice tone="blue" title="Latest plan received">
        Rev 3 contains a reassignment. Review it before loading another trip.
      </Notice>
      <ActionButton label="Review plan update" onPress={() => go('/tabs/today')} />
      <ActionButton variant="secondary" label="Back to today’s loading" onPress={() => go('/tabs/today')} />
    </Screen>
  );
}

export function SyncQueueScreen() {
  const go = useGo();
  const [checking, setChecking] = useState(false);

  const retry = async () => {
    setChecking(true);
    const state = await NetInfo.fetch();
    setChecking(false);
    if (state.isConnected && state.isInternetReachable !== false) go('/tabs/synced');
  };

  return (
    <Screen title="Sync queue">
      <Notice tone="amber" title="Offline · records are safe">
        Last plan received at 22:10 · Rev 2. Reconnect to receive newer changes.
      </Notice>
      <InfoCard title="3 loading checks saved" lines={['OUT081 · 03:05', 'OUT065 · 03:07', 'OUT052 · 03:09']} />
      <InfoCard
        title="Issue report queued"
        lines={['ORD0092322 · saved 03:12', 'Dispatcher has not received it yet.']}
      />
      <InfoCard title="Departure sign-off" lines={['VEH018 · saved 03:29', 'Driver unlock pending sync']} />
      <ActionButton label={checking ? 'Checking…' : 'Try reconnecting'} onPress={retry} />
      <ActionButton variant="secondary" label="Continue working" onPress={() => go('/tabs/today')} />
    </Screen>
  );
}

/* ---------- Depart tab states ---------- */
export function SignoffSavedScreen() {
  const go = useGo();
  return (
    <Screen title="Sign-off saved on this device">
      <Notice tone="amber" title="Waiting for connection">
        Recorded at 03:29. The driver and dispatcher have not yet received this sign-off.
      </Notice>
      <InfoCard
        title="VEH018 · Trip 1"
        lines={['7 orders processed · checks passed', 'Original capture time: 03:29', 'Status: Ready pending sync']}
      />
      <ActionButton label="View sync queue" onPress={() => go('/tabs/sync-queue')} />
      <ActionButton variant="secondary" label="Return to loading list" onPress={() => go('/tabs/today')} />
    </Screen>
  );
}

export function VehicleReadyScreen() {
  const go = useGo();
  return (
    <Screen title="Vehicle ready">
      <Notice tone="green" title="Driver can start Trip 1">
        VEH018 · marked ready at 03:29. Loading-complete status is available to the driver and store managers.
      </Notice>
      <InfoCard
        title="Sign-off complete"
        lines={[
          '7 of 7 orders processed',
          '1 acknowledged shortage',
          '3 inspection gates passed',
          'Bay lead: K. Bandara',
          'Plan rev 3.1 · Peliyagoda',
        ]}
      />
      <ActionButton label="Back to today’s loading" onPress={() => go('/tabs/today')} />
      <ActionButton variant="secondary" label="View signed manifest" onPress={() => {}} />
    </Screen>
  );
}

export function IssueResolvedScreen() {
  const go = useGo();
  return (
    <Screen title="Issue resolved">
      <Notice tone="green" title="Dispatcher approved the adjustment">
        Manifest rev 3.1 · approval received 03:14
      </Notice>
      <InfoCard
        title="8 crates accepted · 2 short"
        lines={['ORD0092322 · OUT027 · Milk 1L', '8 of 10 accepted. The shortfall is recorded on the manifest.']}
      />
      <ActionButton label="Acknowledge and continue" onPress={() => go('/tabs/depart')} />
      <ActionButton variant="secondary" label="Review original report" onPress={() => go('/tabs/report')} />
    </Screen>
  );
}

export function DispatcherPendingScreen() {
  const go = useGo();
  return (
    <Screen title="Dispatcher decision pending">
      <Notice tone="red" title="VEH018 is on hold">
        This trip cannot be marked ready until the dispatcher resolves the blocking issue.
      </Notice>
      <InfoCard
        title="ORD0092322 · OUT027"
        linesTone="dark"
        lines={[
          'Quantity Short · available 8 of 10',
          'Hold vehicle — needs dispatcher',
          'Bay 4 photo attached · 03:12',
          '2 crates damaged in Bay 4',
        ]}
        note="Report captured 03:12 · dispatcher notified"
      />
      {/* TODO: replace with a real "check response" call */}
      <ActionButton label="Check dispatcher response" onPress={() => go('/tabs/issue-resolved')} />
      <ActionButton variant="secondary" label="Return to loading" onPress={() => go('/tabs/checklist')} />
    </Screen>
  );
}

const checks = ['Cargo locked & strapped', 'Reefer set-point verified', 'Rear shutter seal recorded'];

export function DepartureChecksScreen() {
  const go = useGo();
  const [done, setDone] = useState<boolean[]>(checks.map(() => false));

  const toggle = (i: number) => setDone((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  return (
    <Screen title="Departure checks">
      <Notice tone="blue" title="Finish the loading check">
        Verify the physical checks at the bay before final sign-off.
      </Notice>
      {checks.map((label, i) => (
        <InfoCard
          key={label}
          compact
          title={label}
          linesTone={done[i] ? 'success' : 'muted'}
          lines={[done[i] ? '✓ Checked · tap to undo' : '○ Not checked · tap to inspect']}
          onPress={() => toggle(i)}
        />
      ))}
      <ActionButton label="Review readiness" onPress={() => go('/tabs/depart')} />
      <ActionButton variant="secondary" label="Report an inspection failure" onPress={() => go('/tabs/report')} />
    </Screen>
  );
}