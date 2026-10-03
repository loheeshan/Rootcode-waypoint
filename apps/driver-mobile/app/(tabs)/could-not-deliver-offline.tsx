import { useRouter } from "expo-router";
import { OfflineFailureScreen } from "../../src/features/failureoffline/OfflineFailureScreen";
import { mockOfflineFailure } from "../../src/features/failureoffline/mockData";

export default function CouldNotDeliverOffline() {
  const router = useRouter();

  return (
    <OfflineFailureScreen
      data={mockOfflineFailure}
      initialReason="blocked" // design preview only; remove so the driver starts with no selection
      onBack={() => router.back()}
      onOpenStop={() => console.log("open stop details")}
      onRetakePhoto={() => {
        // TODO(feature/driver-pod-ui): open camera, compress the photo
        console.log("retake photo");
      }}
      onSubmit={(payload) => {
        // TODO(feature/driver-sqlite + driver-sync): save to SQLite and queue an outbox event
        console.log("queued failed delivery", payload);
        router.navigate("/stops");
      }}
    />
  );
}