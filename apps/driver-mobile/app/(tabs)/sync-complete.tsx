import { SyncCompleteScreen } from "../../src/features/synccomplete/SyncCompleteScreen";
import { mockSyncComplete } from "../../src/features/synccomplete/mockData";

export default function SyncComplete() {
  return (
    <SyncCompleteScreen
      data={mockSyncComplete}
      onReviewRouteUpdate={() => {
        // TODO: open the revised stop sequence (the trip overview with the route revision banner)
        console.log("review route update");
      }}
    />
  );
}