import { useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { SplashScreen } from '../src/features/splash/SplashScreen';
import { useBootstrap } from '../src/features/splash/useBootstrap';

export default function Index() {
  const router = useRouter();
  const { progress, statusText, cachedOutlets, destination } = useBootstrap();

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  return (
    // <SplashScreen
    //   progress={progress}
    //   statusText={statusText}
    //   cachedOutlets={cachedOutlets}
    // />
    //<Redirect href="/start-trip" />
    //<Redirect href="/navigate-outlet" />
    <Redirect href="/stops/navigation-preview" />
  );
}