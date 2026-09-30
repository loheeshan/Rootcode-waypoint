import { Component, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import { initializeDatabase } from '../src/storage/database';
class StorageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <View style={{ padding: 24 }}><Text accessibilityRole="alert">Local storage could not open. Restart the app to try again.</Text></View>;
    return this.props.children;
  }
}
export default function RootLayout() {
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1 }}><StorageBoundary><SQLiteProvider databaseName="waypoint-driver.db" onInit={initializeDatabase}><Stack><Stack.Screen name="index" options={{ title: 'Waypoint Driver' }} /></Stack></SQLiteProvider></StorageBoundary></SafeAreaView></SafeAreaProvider>;
}
