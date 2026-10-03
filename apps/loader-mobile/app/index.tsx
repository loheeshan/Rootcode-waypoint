import { useRouter } from 'expo-router';

import { LoaderSplashScreen } from '../src/features/splash/SplashScreen';

export default function Index() {
  const router = useRouter();
  return <LoaderSplashScreen onFinish={() => router.replace('/tabs/today')} />;
}