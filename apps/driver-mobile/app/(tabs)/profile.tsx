import { PlaceholderScreen } from "../../src/components/PlaceholderScreen";
import { Text, View } from 'react-native';

export default function Profile() {
  return <PlaceholderScreen title="Profile" />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Profile (coming soon)</Text>
    </View>
  );
}