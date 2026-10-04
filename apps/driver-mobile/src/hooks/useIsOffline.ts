import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** True when NetInfo reports no connection or no internet reachability. */
export function useIsOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => {
    setOffline(s.isConnected === false || s.isInternetReachable === false);
  }), []);
  return offline;
}
