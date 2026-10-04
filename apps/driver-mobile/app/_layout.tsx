import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthGate, AuthProvider } from '../src/services/auth';

// Keep the native splash up until our React splash has mounted.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </AuthProvider>
  );
}