import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { HOME, useAuth } from '../src/services/auth';

export default function Index() {
  const { status } = useAuth();
  // A stored session is used only after the server confirms it with /me.
  if (status === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator accessibilityLabel="Checking your session" />
      </View>
    );
  }
  return <Redirect href={status === 'signed-in' ? HOME : '/welcome'} />;
}
