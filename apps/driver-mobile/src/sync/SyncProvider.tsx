import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { Outbox, type OutboxStatus, type SyncStop } from '@waypoint/mobile-sync';

import { useAuth } from '../services/auth';
import { runDriverSync } from './driverSync';
import { asSqlDatabase } from './sqlite';
import { openDeliverIntents } from './store';

type SyncState = {
  db: SQLiteDatabase;
  outbox: Outbox;
  /** Signed-in account whose queue is shown and sent; null when signed out. */
  userId: string | null;
  counts: Record<OutboxStatus, number>;
  running: boolean;
  /** Why the last run stopped (offline, unauthorized, forbidden, server) or null when it finished. */
  stopped: Exclude<SyncStop, 'done' | 'busy'> | null;
  lastSyncedAt: string | null;
  /** Bumped after every local write or sync run so screens re-read local state. */
  version: number;
  /** Call after storing an event; refreshes local state and tries to send now. */
  changed: () => void;
  syncNow: () => void;
  discard: (eventId: string) => Promise<void>;
};

const SyncContext = createContext<SyncState | null>(null);
const EMPTY: Record<OutboxStatus, number> = { pending: 0, syncing: 0, synced: 0, failed: 0 };
let recovered = false;
const PROOF_RECHECK_MS = 15_000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { user, status } = useAuth();
  const userId = status === 'signed-in' ? user?.id ?? null : null;
  const outbox = useMemo(() => new Outbox(asSqlDatabase(db), { uuid: randomUUID }), [db]);
  const [counts, setCounts] = useState(EMPTY);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<SyncState['stopped']>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef<string | null>(null);
  active.current = userId;

  const refreshCounts = useCallback(async () => {
    if (userId) {
      const [queue, proofs] = await Promise.all([outbox.counts(userId), openDeliverIntents(db, userId)]);
      // Proof photos still to upload count as unsent work too.
      setCounts({ ...queue, pending: queue.pending + proofs.filter((p) => p.status === 'pending').length });
    } else {
      setCounts(EMPTY);
    }
    setVersion((v) => v + 1);
  }, [db, outbox, userId]);

  // One run at a time; a request that arrives meanwhile triggers exactly one follow-up run.
  const inRun = useRef(false);
  const again = useRef(false);

  const run = useCallback(async (): Promise<void> => {
    const id = active.current;
    if (!id) return;
    if (inRun.current) {
      again.current = true;
      return;
    }
    inRun.current = true;
    if (!recovered) {
      recovered = true;
      await outbox.recover();
    }
    if (timer.current) clearTimeout(timer.current);
    setRunning(true);
    try {
      const report = await runDriverSync(db, outbox, id);
      if (active.current !== id || report.stop === 'busy') return;
      setStopped(report.stop === 'done' ? null : report.stop);
      if (report.synced.length) setLastSyncedAt(new Date().toISOString());
      // Bounded backoff: wake up when the earliest waiting event may be retried, or check a waiting
      // proof upload again shortly.
      if (report.stop !== 'unauthorized' && report.stop !== 'forbidden') {
        const due = report.nextAttemptAt ? new Date(report.nextAttemptAt).getTime() - Date.now() : null;
        const delay = due !== null ? Math.max(1_000, due) : report.proofsWaiting ? PROOF_RECHECK_MS : null;
        if (delay !== null) timer.current = setTimeout(() => { void run(); }, delay);
      }
    } catch {
      if (active.current === id) setStopped('server');
    } finally {
      inRun.current = false;
      if (active.current === id) {
        setRunning(false);
        await refreshCounts();
      }
      if (again.current) {
        again.current = false;
        void run();
      }
    }
  }, [db, outbox, refreshCounts]);

  // A new account starts clean: its own counts, no state from the previous user.
  useEffect(() => {
    setStopped(null);
    setLastSyncedAt(null);
    void refreshCounts();
    if (userId) void run();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [userId, refreshCounts, run]);

  // Connectivity back or app brought to the foreground: retry waiting events now.
  useEffect(() => {
    if (!userId) return;
    // Only an offline -> online change skips the backoff; repeated online events do not.
    let wasOnline: boolean | null = null;
    const net = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (online && wasOnline === false) void outbox.retryNow(userId).then(run);
      wasOnline = online;
    });
    const app = AppState.addEventListener('change', (next) => { if (next === 'active') void run(); });
    return () => { net(); app.remove(); };
  }, [userId, outbox, run]);

  const changed = useCallback(() => {
    void refreshCounts().then(run);
  }, [refreshCounts, run]);

  const syncNow = useCallback(() => {
    if (!userId) return;
    setStopped(null);
    void outbox.retryNow(userId).then(run);
  }, [outbox, userId, run]);

  const discard = useCallback(async (eventId: string) => {
    if (!userId) return;
    await outbox.discard(userId, eventId);
    changed();
  }, [outbox, userId, changed]);

  const value = useMemo(
    () => ({ db, outbox, userId, counts, running, stopped, lastSyncedAt, version, changed, syncNow, discard }),
    [db, outbox, userId, counts, running, stopped, lastSyncedAt, version, changed, syncNow, discard],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}
