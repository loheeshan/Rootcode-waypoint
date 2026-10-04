import { SyncScreen } from "../../src/features/sync/SyncScreen";
import { mockSync } from "../../src/features/sync/mockData";
import { Text, View } from 'react-native';


export default function Sync() {
  return (
    <SyncScreen
      data={mockSync}
      onRetry={() => {
        // TODO(feature/driver-sync): NetInfo check + flush outbox
        console.log("retry sync");
      }}
    />
  );
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Sync (coming soon)</Text>
    </View>
  );
}