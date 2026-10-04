import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useRouter, useSegments } from 'expo-router';
import { ApiError, signIn as apiSignIn, type AuthUser } from '@waypoint/api-contracts';
import { apiUrl, getApiClient, setUnauthorizedHandler } from './api';
import { session } from './session';

const ROLE = 'LOADER' as const;
/** Routes reachable without a session; everything else requires one. */
const PUBLIC = new Set(['', 'index', 'welcome', 'start-shift', 'sign-in-help']);
export const HOME = '/tabs/today' as const;
export const LOGIN = '/start-shift' as const;

type Status = 'checking' | 'signed-in' | 'signed-out';
export type AuthNotice = 'expired' | 'wrong-role' | 'network' | 'unavailable' | null;
export const noticeMessages: Record<Exclude<AuthNotice, null>, string> = {
  expired: 'Your session has expired. Sign in again.',
  'wrong-role': 'This account does not have Loader access.',
  network: 'Cannot reach the Waypoint server. Check your connection and try again.',
  unavailable: 'Sign-in is temporarily unavailable. Try again shortly.',
};

type AuthState = {
  status: Status;
  user: AuthUser | null;
  /**
   * False while offline after relaunch: the remembered session is used for cached work but has
   * not been re-confirmed by the server. Server calls still recheck permissions.
   */
  verified: boolean;
  notice: AuthNotice;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  /** Ends the session after a 401: clears the token and asks the user to sign in. */
  expire: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const hasRole = (user: AuthUser) => user.is_active && user.roles.includes(ROLE);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [verified, setVerified] = useState(false);
  const [notice, setNotice] = useState<AuthNotice>(null);
  // Bumped by sign-in/out so a slow relaunch check cannot overwrite a newer session.
  const generation = useRef(0);

  const expire = useCallback(async () => {
    generation.current += 1;
    await session.clear();
    setUser(null);
    setVerified(false);
    setNotice('expired');
    setStatus('signed-out');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { void expire(); });
    return () => setUnauthorizedHandler(null);
  }, [expire]);

  // Relaunch: confirm a stored token with /me. Offline, a remembered session continues with
  // its cached profile; only an explicit 401 ends it.
  useEffect(() => {
    const started = generation.current;
    (async () => {
      const token = await session.getToken();
      if (!token) {
        if (generation.current === started) setStatus('signed-out');
        return;
      }
      try {
        const me = await getApiClient().request<AuthUser>('/me');
        if (generation.current !== started) return;
        if (hasRole(me)) {
          await session.cacheUser(me);
          setUser(me);
          setVerified(true);
          setStatus('signed-in');
          return;
        }
        await session.clear();
        setNotice('wrong-role');
        setStatus('signed-out');
      } catch (error) {
        if (generation.current !== started) return;
        if (error instanceof ApiError && error.status === 401) return; // expire() handled it.
        const cached = await session.getCachedUser();
        if (generation.current !== started) return;
        if (cached && hasRole(cached)) {
          setUser(cached);
          setVerified(false);
          setStatus('signed-in');
          return;
        }
        setNotice(error instanceof ApiError ? 'unavailable' : 'network');
        setStatus('signed-out');
      }
    })();
  }, []);

  // When connectivity returns, re-confirm an offline (unverified) session with the server.
  useEffect(() => {
    if (status !== 'signed-in' || verified) return;
    return NetInfo.addEventListener((state) => {
      if (!state.isConnected || state.isInternetReachable === false) return;
      const started = generation.current;
      getApiClient().request<AuthUser>('/me').then(async (me) => {
        if (generation.current !== started) return;
        if (!hasRole(me)) {
          await session.clear();
          generation.current += 1;
          setUser(null);
          setNotice('wrong-role');
          setStatus('signed-out');
          return;
        }
        await session.cacheUser(me);
        setUser(me);
        setVerified(true);
      }).catch(() => undefined); // 401 already expired the session; other errors retry later.
    });
  }, [status, verified]);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    const result = await apiSignIn(apiUrl(), email, password, ROLE);
    generation.current += 1;
    await session.setToken(result.access_token, remember);
    await session.cacheUser(result.user, remember);
    setUser(result.user);
    setVerified(true);
    setNotice(null);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(async () => {
    generation.current += 1;
    await session.clear();
    setUser(null);
    setVerified(false);
    setNotice(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo(
    () => ({ status, user, verified, notice, signIn, signOut, expire }),
    [status, user, verified, notice, signIn, signOut, expire],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** Redirects protected deep links to sign-in once the app knows there is no session. */
export function AuthGate() {
  const { status } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  useEffect(() => {
    if (status !== 'signed-out') return;
    if (!PUBLIC.has(segments[0] ?? '')) router.replace(LOGIN);
  }, [status, segments, router]);
  return null;
}
