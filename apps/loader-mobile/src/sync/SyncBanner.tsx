import { StyleSheet, Text, View } from 'react-native';
import type { OutboxEvent } from '@waypoint/mobile-sync';

import { ActionButton, Notice } from '../components/ui/ScreenKit';
import { LOAD_LABEL, colomboTime, shortId } from '../features/loading/format';
import { t } from '../theme/loaderTokens';
import { useSync } from './SyncProvider';

const STOPPED: Record<string, string> = {
  offline: 'No connection. Changes are saved on this phone and are sent automatically when you are back online.',
  unauthorized: 'Your session has expired. Sign in again to send the changes saved on this phone.',
  forbidden: 'This account no longer has Loader access for this work. Changes stay on this phone; contact your dispatcher.',
  server: 'The server is not accepting changes right now. They are kept on this phone and retried automatically.',
};

/** Queue status for the signed-in account: waiting, sending, needs attention or all synced. */
export function SyncBanner() {
  const { counts, running, stopped, lastSyncedAt, syncNow } = useSync();
  const waiting = counts.pending + counts.syncing;
  if (!waiting && !counts.failed && !stopped) {
    return (
      <Text style={styles.synced} accessibilityRole="text">
        ✓ All changes synced{lastSyncedAt ? ` · last sent ${colomboTime(lastSyncedAt)}` : ''}
      </Text>
    );
  }
  return (
    <View style={styles.wrap}>
      {waiting ? (
        <Notice tone={stopped ? 'amber' : 'blue'} title={running ? `Sending ${waiting} change${waiting === 1 ? '' : 's'}…` : `${waiting} change${waiting === 1 ? '' : 's'} waiting to sync`}>
          {stopped ? STOPPED[stopped] : 'Saved on this phone. Not yet confirmed by the server.'}
        </Notice>
      ) : stopped ? <Notice tone="amber" title="Sync paused">{STOPPED[stopped]}</Notice> : null}
      {counts.failed ? (
        <Notice tone="red" title={`${counts.failed} change${counts.failed === 1 ? '' : 's'} need${counts.failed === 1 ? 's' : ''} attention`}>
          The server did not apply {counts.failed === 1 ? 'it' : 'them'}. Open the trip's checklist to review and discard.
        </Notice>
      ) : null}
      {waiting && stopped !== 'unauthorized' && stopped !== 'forbidden' ? (
        <ActionButton small variant="secondary" label={running ? 'Sending…' : 'Sync now'} disabled={running} onPress={syncNow} />
      ) : null}
    </View>
  );
}

/** One not-applied load event with the server's reason and a way to drop it. */
export function AttentionList({ events }: { events: OutboxEvent[] }) {
  if (!events.length) return null;
  return (
    <Notice tone="red" title={`${events.length} loading change${events.length === 1 ? '' : 's'} not applied`}>
      {events.map((e) => {
        const p = e.payload as { order_id: string; status: keyof typeof LOAD_LABEL };
        return `Order ${shortId(p.order_id)} → ${LOAD_LABEL[p.status]}: ${e.detail ?? e.outcome}`;
      }).join('\n')}
      {'\n'}Later changes for this trip wait until these are reviewed. Discard to keep the server's version.
    </Notice>
  );
}

export function DiscardButtons({ events, onDiscard }: { events: OutboxEvent[]; onDiscard: (eventId: string) => void }) {
  return (
    <>
      {events.map((e) => {
        const p = e.payload as { order_id: string };
        return <ActionButton key={e.event_id} small variant="secondary" label={`Discard change for order ${shortId(p.order_id)}`} onPress={() => onDiscard(e.event_id)} />;
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  synced: { fontSize: 13, fontWeight: '700', color: t.green },
});
