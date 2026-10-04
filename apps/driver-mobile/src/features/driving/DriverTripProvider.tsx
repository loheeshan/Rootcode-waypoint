import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  errorMessage,
  type DeliveryFailureReason,
  type DriverTripDetailResponse,
  type SyncEventType,
} from '@waypoint/api-contracts';
import type { OutboxEvent } from '@waypoint/mobile-sync';
import { randomUUID } from 'expo-crypto';

import { getApiClient } from '../../services/api';
import { useSync } from '../../sync/SyncProvider';
import { addDeliverIntent, readTripView, saveTripView, tripDeliverIntents, type DeliverIntent } from '../../sync/store';
import { overlay, type TripView } from './overlay';
import { discardDraft, type PodDraft } from './podDraft';

export type { LocalState, StopView, TripView } from './overlay';

/**
 * Delivery workflow for the selected trip, offline first: every action is stored in the SQLite
 * outbox before the screen shows it, and sent by the SyncProvider when the server is reachable.
 */
type DriverTripState = {
  tripId: string | null;
  /** Cached server trip with unsent actions applied; `stop.local`/`tripLocal` mark unconfirmed state. */
  detail: TripView | null;
  /** The trip status the server last reported (READY is only ever taken from here). */
  serverStatus: DriverTripDetailResponse['trip']['status'] | null;
  fetchedAt: string | null;
  offline: boolean;
  /** Actions the server did not apply (REJECTED/CONFLICT), oldest first. */
  attention: OutboxEvent[];
  intents: DeliverIntent[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  select: (tripId: string) => void;
  refresh: () => Promise<void>;
  clearError: () => void;
  start: () => Promise<boolean>;
  arrive: (stopId: string) => Promise<boolean>;
  /** Saves the proof and the delivery; the photo uploads before the delivery is sent. */
  confirmDelivery: (draft: PodDraft) => Promise<boolean>;
  /** Delivers with a proof the server already holds (uploaded before offline mode existed). */
  deliverUploaded: (stopId: string, podId: string) => Promise<boolean>;
  fail: (stopId: string, reason: DeliveryFailureReason, note: string) => Promise<boolean>;
  complete: () => Promise<boolean>;
  discard: (eventId: string) => Promise<void>;
};

const DriverTripContext = createContext<DriverTripState | null>(null);

export function DriverTripProvider({ children }: { children: ReactNode }) {
  const sync = useSync();
  const { db, outbox, userId, version, changed } = sync;
  const [tripId, setTripId] = useState<string | null>(null);
  const [server, setServer] = useState<DriverTripDetailResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [intents, setIntents] = useState<DeliverIntent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const current = useRef<{ trip: string | null; user: string | null }>({ trip: null, user: null });
  const loadSeq = useRef(0);

  const readLocal = useCallback(async (user: string, trip: string) => {
    const [cached, open, proofs] = await Promise.all([
      readTripView(db, user, trip),
      outbox.list(user, { tripId: trip, statuses: ['pending', 'syncing', 'failed'] }),
      tripDeliverIntents(db, user, trip),
    ]);
    if (current.current.trip !== trip || current.current.user !== user) return;
    if (cached) {
      setServer(cached.value);
      setFetchedAt(cached.fetchedAt);
    }
    setEvents(open);
    setIntents(proofs);
  }, [db, outbox]);

  const load = useCallback(async (user: string, trip: string) => {
    const seq = ++loadSeq.current;
    const latest = () => loadSeq.current === seq && current.current.trip === trip && current.current.user === user;
    setLoading(true);
    await readLocal(user, trip);
    try {
      const view = await getApiClient().request<DriverTripDetailResponse>(`/trips/${trip}`);
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
    setIntents([]);
    setError(null);
  }, [userId]);

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
      setIntents([]);
    }
    setError(null);
    void load(userId, id);
  }, [userId, load]);

  const refresh = useCallback(async () => {
    const { trip, user } = current.current;
    if (trip && user) await load(user, trip);
  }, [load]);

  const clearError = useCallback(() => setError(null), []);

  const detail = useMemo(() => (server ? overlay(server, events) : null), [server, events]);
  const attention = useMemo(() => events.filter((e) => e.status === 'failed'), [events]);

  /** Store one action in the outbox (unless the trip is blocked by an action needing attention). */
  const queue = useCallback((type: SyncEventType, stopId: string | null, payload: Record<string, unknown>,
    allowed: (view: TripView) => boolean, extra?: (user: string, trip: string, eventId: string) => Promise<void>) => (async () => {
    const { trip, user } = current.current;
    if (!trip || !user || !detail || detail.trip.trip_id !== trip || inFlight.current) return false;
    if (attention.length) {
      setError('Review the change the server did not apply before continuing this trip.');
      return false;
    }
    if (!allowed(detail)) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const eventId = randomUUID();
      await extra?.(user, trip, eventId);
      await outbox.add(user, {
        event_id: eventId, type, trip_id: trip, stop_id: stopId, subject_id: stopId ?? trip,
        payload: { ...payload, occurred_at: new Date().toISOString() },
      });
      await readLocal(user, trip);
      changed();
      return true;
    } catch {
      setError('This could not be saved on the phone. Try again.');
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  })(), [detail, attention.length, outbox, readLocal, changed]);

  const stopOf = (view: TripView, stopId: string) => view.stops.find((s) => s.stop_id === stopId);

  // Start only when the server copy says READY; never on a locally assumed state.
  const start = useCallback(() => queue('TRIP_STARTED', null, {},
    (v) => server?.trip.status === 'READY' && v.trip.status === 'READY'), [queue, server]);

  const arrive = useCallback((stopId: string) => queue('STOP_ARRIVED', stopId, {},
    (v) => v.trip.status === 'IN_PROGRESS' && stopOf(v, stopId)?.status === 'PLANNED'
      && !v.stops.some((s) => s.status === 'ARRIVED')), [queue]);

  const fail = useCallback((stopId: string, reason: DeliveryFailureReason, note: string) =>
    queue('STOP_FAILED', stopId, { reason_code: reason, note },
      (v) => v.trip.status === 'IN_PROGRESS' && ['PLANNED', 'ARRIVED'].includes(stopOf(v, stopId)?.status ?? '')), [queue]);

  const confirmDelivery = useCallback((draft: PodDraft) => queue('STOP_DELIVERED', draft.stopId, { pod_id: draft.podId },
    (v) => v.trip.status === 'IN_PROGRESS' && stopOf(v, draft.stopId)?.status === 'ARRIVED',
    async (user, trip, eventId) => {
      // The intent shares the event's ID; the photo stays until the server has the proof.
      await addDeliverIntent(db, user, trip, draft.stopId, draft.podId, draft.photoUri, draft.receiverName, draft.capturedAt, eventId);
      discardDraft({ stopId: draft.stopId, photoUri: '' });
    }), [queue, db]);

  const deliverUploaded = useCallback((stopId: string, podId: string) => queue('STOP_DELIVERED', stopId, { pod_id: podId },
    (v) => v.trip.status === 'IN_PROGRESS' && stopOf(v, stopId)?.status === 'ARRIVED'), [queue]);

  const complete = useCallback(() => queue('TRIP_COMPLETED', null, {},
    (v) => v.trip.status === 'IN_PROGRESS'
      && v.stops.every((s) => !s.requires_visit || s.status === 'DELIVERED' || s.status === 'FAILED')), [queue]);

  const discard = useCallback(async (eventId: string) => {
    await sync.discard(eventId);
    const { trip, user } = current.current;
    if (trip && user) await readLocal(user, trip);
  }, [sync, readLocal]);

  const value = useMemo(() => ({
    tripId, detail, serverStatus: server?.trip.status ?? null, fetchedAt, offline, attention, intents, loading, error, busy,
    select, refresh, clearError, start, arrive, confirmDelivery, deliverUploaded, fail, complete, discard,
  }), [tripId, detail, server, fetchedAt, offline, attention, intents, loading, error, busy,
    select, refresh, clearError, start, arrive, confirmDelivery, deliverUploaded, fail, complete, discard]);
  return <DriverTripContext.Provider value={value}>{children}</DriverTripContext.Provider>;
}

export function useDriverTrip(): DriverTripState {
  const value = useContext(DriverTripContext);
  if (!value) throw new Error('useDriverTrip must be used inside DriverTripProvider');
  return value;
}

function describeRead(failure: unknown): string {
  if (!(failure instanceof ApiError)) return 'No connection. Showing the copy saved on this phone.';
  if (failure.status === 401) return 'Your session has expired. Sign in again.';
  if (failure.status === 404) return 'This trip is not assigned to you.';
  return errorMessage(failure, 'Could not refresh the trip. Pull to try again.');
}
