import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  errorMessage,
  type LoadEventResponse,
  type LoadStatus,
  type TripLoadingResponse,
} from '@waypoint/api-contracts';
import { randomUUID } from 'expo-crypto';

import { getApiClient } from '../../services/api';

/** Online loading for one selected trip. Offline queuing is added with the SQLite outbox. */
type LoadingState = {
  tripId: string | null;
  view: TripLoadingResponse | null;
  loading: boolean;
  /** Last failure shown to the user (server message or connectivity). */
  error: string | null;
  /** True while an event or ready request is in flight; actions are disabled meanwhile. */
  busy: boolean;
  select: (tripId: string) => void;
  refresh: () => Promise<void>;
  record: (orderId: string, status: LoadStatus, note?: string) => Promise<boolean>;
  markReady: () => Promise<boolean>;
};

const LoadingContext = createContext<LoadingState | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [tripId, setTripId] = useState<string | null>(null);
  const [view, setView] = useState<TripLoadingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // One ID per intended action: a retry of the same payload reuses it so the server applies it once.
  const eventIds = useRef(new Map<string, string>());
  const readyIds = useRef(new Map<string, string>());

  // The trip the user last selected; responses for any other trip are dropped.
  const current = useRef<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const next = await getApiClient().request<TripLoadingResponse>(`/trips/${id}/loading`);
      if (current.current !== id) return;
      setView(next);
      setError(null);
    } catch (failure) {
      if (current.current !== id) return;
      // Keep the last server view; only report that it could not be refreshed.
      setError(describeRead(failure));
    } finally {
      if (current.current === id) setLoading(false);
    }
  }, []);

  const select = useCallback((id: string) => {
    if (current.current !== id) {
      current.current = id;
      setTripId(id);
      setView(null);
    }
    setError(null);
    void load(id);
  }, [load]);

  const refresh = useCallback(async () => {
    if (tripId) await load(tripId);
  }, [tripId, load]);

  const guarded = useCallback(async (action: (id: string) => Promise<void>): Promise<boolean> => {
    const id = current.current;
    if (!id || inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action(id);
      return current.current === id;
    } catch (failure) {
      if (current.current !== id) return false;
      // Conflicts mean the server state moved on (e.g. finalized or stale); show it.
      // Reload first because a successful load() clears the error.
      if (failure instanceof ApiError && failure.status === 409) await load(id);
      setError(describe(failure));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [load]);

  const record = useCallback((orderId: string, status: LoadStatus, note?: string) => guarded(async (id) => {
    const key = `${id}:${orderId}:${status}:${note ?? ''}`;
    if (!eventIds.current.has(key)) eventIds.current.set(key, randomUUID());
    await getApiClient().request<LoadEventResponse>(`/trips/${id}/load-events`, {
      method: 'POST',
      body: JSON.stringify({ event_id: eventIds.current.get(key), order_id: orderId, status, note: note ?? null }),
    });
    // A newer outcome for this order supersedes any unconfirmed attempt; never replay those IDs later.
    for (const k of [...eventIds.current.keys()]) if (k.startsWith(`${id}:${orderId}:`)) eventIds.current.delete(k);
    await load(id);
  }), [guarded, load]);

  const markReady = useCallback(() => guarded(async (id) => {
    if (!view || view.trip.trip_id !== id) return;
    const key = `${id}:${view.last_event_sequence}`;
    if (!readyIds.current.has(key)) readyIds.current.set(key, randomUUID());
    const result = await getApiClient().request<TripLoadingResponse>(`/trips/${id}/ready`, {
      method: 'POST',
      body: JSON.stringify({ request_id: readyIds.current.get(key), last_event_sequence: view.last_event_sequence }),
    });
    if (current.current === id) setView(result);
  }), [view, guarded]);

  const value = useMemo(
    () => ({ tripId, view, loading, error, busy, select, refresh, record, markReady }),
    [tripId, view, loading, error, busy, select, refresh, record, markReady],
  );
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading(): LoadingState {
  const value = useContext(LoadingContext);
  if (!value) throw new Error('useLoading must be used inside LoadingProvider');
  return value;
}

function describe(failure: unknown): string {
  if (!(failure instanceof ApiError)) return 'Cannot reach the Waypoint server. Nothing was saved; try again.';
  if (failure.status === 401) return 'Your session has expired. Sign in again.';
  if (failure.status === 404) return 'This trip is no longer available to your account.';
  return errorMessage(failure, 'The server could not save this. Try again.');
}

function describeRead(failure: unknown): string {
  if (!(failure instanceof ApiError)) return 'Could not refresh the trip (no connection). Pull to try again.';
  if (failure.status === 401) return 'Your session has expired. Sign in again.';
  if (failure.status === 404) return 'This trip is no longer available to your account.';
  return errorMessage(failure, 'Could not refresh the trip. Pull to try again.');
}
