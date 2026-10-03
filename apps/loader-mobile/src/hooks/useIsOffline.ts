// src/hooks/useIsOffline.ts
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

// Set true/false to preview a state without airplane mode. null = real status.
const FORCE_OFFLINE: boolean | null = null;

export function useIsOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (FORCE_OFFLINE !== null) {
      setOffline(FORCE_OFFLINE);
      return;
    }
    return NetInfo.addEventListener((s) => {
      setOffline(s.isConnected === false || s.isInternetReachable === false);
    });
  }, []);

  return offline;
}