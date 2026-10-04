import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { AuthGate, AuthProvider } from '../src/services/auth';
import { initializeDatabase } from '../src/storage/database';
import { SyncProvider } from '../src/sync/SyncProvider';

class StorageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <View style={{ padding: 24 }}><Text accessibilityRole="alert">Local storage could not open. Restart the app to try again.</Text></View>;
    return this.props.children;
  }
}

// Keep the native splash up until our React splash has mounted.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <StorageBoundary>
      <SQLiteProvider databaseName="waypoint-driver.db" onInit={initializeDatabase}>
        <AuthProvider>
          <SyncProvider>
            <StatusBar style="light" />
            <AuthGate />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
          </SyncProvider>
        </AuthProvider>
      </SQLiteProvider>
    </StorageBoundary>
  );
}