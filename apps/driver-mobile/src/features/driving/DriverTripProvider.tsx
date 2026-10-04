import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  errorMessage,
  type DeliveryEventResponse,
  type DeliveryFailureReason,
  type DriverTripDetailResponse,
  type PodResponse,
} from '@waypoint/api-contracts';
import { randomUUID } from 'expo-crypto';

import { getApiClient } from '../../services/api';
import { discardDraft, readBase64, type PodDraft } from './podDraft';

/** Online delivery workflow for the selected trip. Offline queuing arrives with the SQLite outbox. */
type DriverTripState = {
  tripId: string | null;
  detail: DriverTripDetailResponse | null;
  loading: boolean;
  /** Last failure shown to the user (server message or connectivity). */
  error: string | null;
  /** True while a write is in flight; actions are disabled meanwhile. */
  busy: boolean;
  select: (tripId: string) => void;
  refresh: () => Promise<void>;
  clearError: () => void;
  start: () => Promise<boolean>;
  arrive: (stopId: string) => Promise<boolean>;
  uploadPod: (draft: PodDraft) => Promise<PodResponse | null>;
  deliver: (stopId: string, podId: string) => Promise<boolean>;
  fail: (stopId: string, reason: DeliveryFailureReason, note: string) => Promise<boolean>;
  complete: () => Promise<boolean>;
};

const DriverTripContext = createContext<DriverTripState | null>(null);

export function DriverTripProvider({ children }: { children: ReactNode }) {
  const [tripId, setTripId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DriverTripDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // The trip the driver last selected; responses for any other trip are dropped.
  const current = useRef<string | null>(null);
  // One event ID per intended action, reused for retries until the server accepts it.
  const eventIds = useRef(new Map<string, string>());
  // Only the most recently started load may update the view (a slow refresh must not undo a write).
  const loadSeq = useRef(0);

  const load = useCallback(async (id: string) => {
    const seq = ++loadSeq.current;
    const latest = () => current.current === id && loadSeq.current === seq;
    setLoading(true);
    try {
      const next = await getApiClient().request<DriverTripDetailResponse>(`/trips/${id}`);
      if (!latest()) return;
      setDetail(next);
      setError(null);
    } catch (failure) {
      if (!latest()) return;
      // Keep the last server view; only report that it could not be refreshed.
      setError(describeRead(failure));
    } finally {
      if (latest()) setLoading(false);
    }
  }, []);

  const select = useCallback((id: string) => {
    if (current.current !== id) {
      current.current = id;
      setTripId(id);
      setDetail(null);
    }
    setError(null);
    void load(id);
  }, [load]);

  const refresh = useCallback(async () => {
    if (current.current) await load(current.current);
  }, [load]);

  const clearError = useCallback(() => setError(null), []);

  const guarded = useCallback(async <T,>(action: (id: string) => Promise<T>): Promise<T | null> => {
    const id = current.current;
    if (!id || inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await action(id);
      if (current.current !== id) return null;
      await load(id);
      return result;
    } catch (failure) {
      if (current.current !== id) return null;
      // Conflicts mean the server state moved on; show the server's view and the reason.
      if (failure instanceof ApiError && failure.status === 409) await load(id);
      setError(describe(failure));
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [load]);

  /** POST an event with the action's stable ID; forget the IDs for `scope` once accepted. */
  const send = useCallback(async (path: string, key: string, scope: string, body: object = {}) => {
    if (!eventIds.current.has(key)) eventIds.current.set(key, randomUUID());
    const event = await getApiClient().request<DeliveryEventResponse>(path, {
      method: 'POST',
      body: JSON.stringify({ event_id: eventIds.current.get(key), ...body }),
    });
    for (const k of [...eventIds.current.keys()]) if (k.startsWith(scope)) eventIds.current.delete(k);
    return event;
  }, []);

  const start = useCallback(async () => (await guarded((id) =>
    send(`/trips/${id}/start`, `${id}:start`, `${id}:start`))) !== null, [guarded, send]);

  const arrive = useCallback(async (stopId: string) => (await guarded((id) =>
    send(`/trips/${id}/stops/${stopId}/arrive`, `${id}:${stopId}:arrive`, `${id}:${stopId}:arrive`))) !== null,
  [guarded, send]);

  const deliver = useCallback(async (stopId: string, podId: string) => (await guarded((id) =>
    send(`/trips/${id}/stops/${stopId}/deliver`, `${id}:${stopId}:deliver:${podId}`, `${id}:${stopId}:`, { pod_id: podId }))) !== null,
  [guarded, send]);

  const fail = useCallback(async (stopId: string, reason: DeliveryFailureReason, note: string) => (await guarded((id) =>
    send(`/trips/${id}/stops/${stopId}/fail`, `${id}:${stopId}:fail:${reason}:${note}`, `${id}:${stopId}:`, { reason_code: reason, note }))) !== null,
  [guarded, send]);

  const complete = useCallback(async () => (await guarded((id) =>
    send(`/trips/${id}/complete`, `${id}:complete`, `${id}:complete`))) !== null, [guarded, send]);

  const uploadPod = useCallback((draft: PodDraft) => guarded(async (id) => {
    const pod = await getApiClient().request<PodResponse>(`/trips/${id}/stops/${draft.stopId}/pod`, {
      method: 'POST',
      body: JSON.stringify({
        pod_id: draft.podId,
        receiver_name: draft.receiverName,
        photo_mime_type: 'image/jpeg',
        photo_base64: await readBase64(draft.photoUri).catch(() => { throw new MissingPhotoError(); }),
        captured_at: draft.capturedAt,
      }),
    });
    // The server holds the proof now; the local copy is no longer needed.
    discardDraft(draft);
    return pod;
  }), [guarded]);

  const value = useMemo(
    () => ({ tripId, detail, loading, error, busy, select, refresh, clearError, start, arrive, uploadPod, deliver, fail, complete }),
    [tripId, detail, loading, error, busy, select, refresh, clearError, start, arrive, uploadPod, deliver, fail, complete],
  );
  return <DriverTripContext.Provider value={value}>{children}</DriverTripContext.Provider>;
}

export function useDriverTrip(): DriverTripState {
  const value = useContext(DriverTripContext);
  if (!value) throw new Error('useDriverTrip must be used inside DriverTripProvider');
  return value;
}

class MissingPhotoError extends Error {}

function describe(failure: unknown): string {
  if (failure instanceof MissingPhotoError) return 'The photo is no longer on this phone. Take it again.';
  if (!(failure instanceof ApiError)) return 'Cannot reach the Waypoint server. Nothing was confirmed; try again.';
  if (failure.status === 401) return 'Your session has expired. Sign in again.';
  if (failure.status === 404) return 'This trip or stop is not assigned to you.';
  if (failure.status === 413) return 'The photo is too large to upload. Take it again.';
  return errorMessage(failure, 'The server could not save this. Try again.');
}

function describeRead(failure: unknown): string {
  if (!(failure instanceof ApiError)) return 'Could not refresh the trip (no connection). Pull to try again.';
  if (failure.status === 401) return 'Your session has expired. Sign in again.';
  if (failure.status === 404) return 'This trip is not assigned to you.';
  return errorMessage(failure, 'Could not refresh the trip. Pull to try again.');
}
