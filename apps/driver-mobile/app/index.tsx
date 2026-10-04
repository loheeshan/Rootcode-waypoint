import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SplashScreen } from '../src/features/splash/SplashScreen';
import { useBootstrap } from '../src/features/splash/useBootstrap';
import { HOME, LOGIN, useAuth } from '../src/services/auth';

export default function Index() {
  const router = useRouter();
  const { progress, statusText, cachedOutlets, destination } = useBootstrap();
  const { status } = useAuth();

  // Leave the splash once start-up finished and the server has confirmed (or rejected) the session.
  useEffect(() => {
    if (destination && status !== 'checking') router.replace(status === 'signed-in' ? HOME : LOGIN);
  }, [destination, status, router]);

  return <SplashScreen progress={progress} statusText={statusText} cachedOutlets={cachedOutlets} />;
}
