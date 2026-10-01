import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_KEY = 'waypoint_driver_token';

type Destination = '/login' | null;

type Step = {
  label: string;
  run: () => Promise<void>;
};

const MIN_SPLASH_MS = 1800; // keep the splash visible long enough to read

export function useBootstrap() {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Starting Waypoint...');
  const [cachedOutlets, setCachedOutlets] = useState(0);
  const [destination, setDestination] = useState<Destination>(null);

  useEffect(() => {
    let cancelled = false;

    const steps: Step[] = [
      {
        label: 'Checking secure session...',
        run: async () => {
          // Will be used to decide login vs trips once those screens exist.
          await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        },
      },
      {
        label: 'Initializing offline sync engine...',
        run: async () => {
          // TODO (feature/driver-sqlite): open Expo SQLite and create
          // trips, stops, outbox, sync_state tables, e.g. `await initDb();`
        },
      },
      {
        label: 'Loading cached outlets...',
        run: async () => {
          // TODO (feature/driver-sqlite): count cached stops from SQLite.
          if (!cancelled) setCachedOutlets(0);
        },
      },
      {
        label: 'Ready',
        run: async () => {
          // TODO (feature/driver-sync): start NetInfo listener / flush outbox.
        },
      },
    ];

    (async () => {
      const started = Date.now();

      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return;
        setStatusText(steps[i].label);
        try {
          await steps[i].run();
        } catch (e) {
          // Never block the driver on a failed step; log and continue.
          console.warn(`[bootstrap] "${steps[i].label}" failed`, e);
        }
        setProgress(Math.round(((i + 1) / steps.length) * 100));
      }

      const elapsed = Date.now() - started;
      if (elapsed < MIN_SPLASH_MS) {
        await new Promise((r) => setTimeout(r, MIN_SPLASH_MS - elapsed));
      }
      if (cancelled) return;

      // TODO: when the Today's Trips screen exists, route to it if a token exists.
      setDestination('/login');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { progress, statusText, cachedOutlets, destination };
}