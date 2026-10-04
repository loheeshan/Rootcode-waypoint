import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  errorMessage,
  type LoadStatus,
  type TripLoadingResponse,
} from '@waypoint/api-contracts';
import type { OutboxEvent } from '@waypoint/mobile-sync';
import { randomUUID } from 'expo-crypto';

import { getApiClient } from '../../services/api';
import { useSync } from '../../sync/SyncProvider';
import { addReadyRequest, latestReadyRequest, readTripView, saveTripView, type ReadyRequest } from '../../sync/store';
import { canLoad } from './format';
import { overlay, type TripView } from './overlay';

export type { LocalState, OrderView, TripView } from './overlay';


type LoadingState = {
  tripId: string | null;
  view: TripView | null;
  /** When the server copy was fetched; `offline` when the latest fetch failed and the copy is cached. */
  fetchedAt: string | null;
  offline: boolean;
  /** Load events the server did not apply (REJECTED/CONFLICT), oldest first. */
  attention: OutboxEvent[];
  /** Unsent load events for this trip. */
  unsent: number;
  ready: ReadyRequest | null;
  /** True when loading can still change on this phone (server not finalized, no ready request waiting). */
  editable: boolean;
  loading: boolean;
  error: string | null;
  busy: boolean;
  select: (tripId: string) => void;
  refresh: () => Promise<void>;
  record: (orderId: string, status: LoadStatus, note?: string) => Promise<boolean>;
  markReady: () => Promise<boolean>;
  discard: (eventId: string) => Promise<void>;
};

const LoadingContext = createContext<LoadingState | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const sync = useSync();
  const { db, outbox, userId, version, changed } = sync;
  const [tripId, setTripId] = useState<string | null>(null);
  const [server, setServer] = useState<TripLoadingResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [ready, setReady] = useState<ReadyRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // The trip and account the screen shows; results for anything else are dropped.
  const current = useRef<{ trip: string | null; user: string | null }>({ trip: null, user: null });
  const loadSeq = useRef(0);

  /** Re-read this phone's state for the trip: cached server copy, unsent events, ready request. */
  const readLocal = useCallback(async (user: string, trip: string) => {
    const [cached, open, request] = await Promise.all([
      readTripView(db, user, trip),
      outbox.list(user, { tripId: trip }),
      latestReadyRequest(db, user, trip),
    ]);
    if (current.current.trip !== trip || current.current.user !== user) return;
    if (cached) {
      setServer(cached.value);
      setFetchedAt(cached.fetchedAt);
    }
    setEvents(open);
    setReady(request);
  }, [db, outbox]);

  const load = useCallback(async (user: string, trip: string) => {
    const seq = ++loadSeq.current;
    const latest = () => loadSeq.current === seq && current.current.trip === trip && current.current.user === user;
    setLoading(true);
    await readLocal(user, trip);
    try {
      const view = await getApiClient().request<TripLoadingResponse>(`/trips/${trip}/loading`);
      if (!latest()) return;
      await saveTripView(db, user, view);
      await readLocal(user, trip);
      setOffline(false);
      setError(null);
    } catch (failure) {
      if (!latest()) return;
      setOffline(!(failure instanceof ApiError));
      setError(describeRead(failure));
    } finally {
      if (latest()) setLoading(false);
    }
  }, [db, readLocal]);

  // A different account never sees the previous account's trip.
  useEffect(() => {
    current.current = { trip: null, user: userId };
    setTripId(null);
    setServer(null);
    setEvents([]);
    setReady(null);
    setError(null);
  }, [userId]);

  // After every local write or sync pass, show the latest local and cached state.
  useEffect(() => {
    const { trip, user } = current.current;
    if (trip && user) void readLocal(user, trip);
  }, [version, readLocal]);

  const select = useCallback((id: string) => {
    if (!userId) return;
    if (current.current.trip !== id) {
      current.current = { trip: id, user: userId };
      setTripId(id);
      setServer(null);
      setFetchedAt(null);
      setEvents([]);
      setReady(null);
    }
    setError(null);
    void load(userId, id);
  }, [userId, load]);

  const refresh = useCallback(async () => {
    const { trip, user } = current.current;
    if (trip && user) await load(user, trip);
  }, [load]);

  const view = useMemo(() => (server ? overlay(server, events, fetchedAt) : null), [server, events, fetchedAt]);
  const attention = useMemo(() => events.filter((e) => e.status === 'failed' && e.type === 'LOAD_RECORDED'), [events]);
  const unsent = events.filter((e) => e.type === 'LOAD_RECORDED' && (e.status === 'pending' || e.status === 'syncing')).length;
  const readyOpen = ready?.status === 'waiting' || ready?.status === 'queued';
  const editable = !!view && canLoad(view.trip.status) && !readyOpen;

  const guarded = useCallback(async (action: (user: string, trip: string) => Promise<boolean>) => {
    const { trip, user } = current.current;
    if (!trip || !user || inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      return await action(user, trip);
    } catch {
      setError('This could not be saved on the phone. Try again.');
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  const record = useCallback((orderId: string, status: LoadStatus, note?: string) => guarded(async (user, trip) => {
    if (!view || view.trip.trip_id !== trip || !editable) return false;
    const order = view.stops.flatMap((s) => s.orders).find((o) => o.order_id === orderId);
    if (!order) return false;
    // A repeat of the outcome already recorded (e.g. a double tap) adds nothing.
    if (order.load_status === status && (order.note ?? null) === (note ?? null)) return true;
    await outbox.add(user, {
      event_id: randomUUID(),
      type: 'LOAD_RECORDED',
      trip_id: trip,
      subject_id: orderId,
      payload: { order_id: orderId, status, note: note ?? null },
    });
    await readLocal(user, trip);
    changed();
    return true;
  }), [guarded, view, editable, outbox, readLocal, changed]);

  /**
   * Stores a ready request. It is sent only after every load event of the trip is acknowledged,
   * with the sequence the server reports then; the trip shows READY only when the server says so.
   */
  const markReady = useCallback(() => guarded(async (user, trip) => {
    if (!view || view.trip.trip_id !== trip || !editable) return false;
    if (view.pending_count > 0 || view.loaded_count === 0 || attention.length) return false;
    await addReadyRequest(db, user, trip, randomUUID());
    await readLocal(user, trip);
    changed();
    return true;
  }), [guarded, view, editable, attention.length, db, readLocal, changed]);

  const discard = useCallback(async (eventId: string) => {
    await sync.discard(eventId);
    const { trip, user } = current.current;
    if (trip && user) await readLocal(user, trip);
  }, [sync, readLocal]);

  const value = useMemo(
    () => ({ tripId, view, fetchedAt, offline, attention, unsent, ready, editable, loading, error, busy, select, refresh, record, markReady, discard }),
    [tripId, view, fetchedAt, offline, attention, unsent, ready, editable, loading, error, busy, select, refresh, record, markReady, discard],
  );
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading(): LoadingState {
  const value = useContext(LoadingContext);
  if (!value) throw new Error('useLoading must be used inside LoadingProvider');
  return value;
}

function describeRead(failure: unknown): string {
  if (!(failure instanceof ApiError)) return 'No connection. Showing the copy saved on this phone.';
  if (failure.status === 401) return 'Your session has expired. Sign in again.';
  if (failure.status === 404) return 'This trip is no longer available to your account.';
  return errorMessage(failure, 'Could not refresh the trip. Pull to try again.');
}
