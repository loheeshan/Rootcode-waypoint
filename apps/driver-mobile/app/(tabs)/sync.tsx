import { SyncScreen } from "../../src/features/sync/SyncScreen";
import { mockSync } from "../../src/features/sync/mockData";

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
}