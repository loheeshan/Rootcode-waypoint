import { useRouter } from "expo-router";
import { CouldNotDeliverScreen } from "../../src/features/failure/CouldNotDeliverScreen";
import { mockFailure } from "../../src/features/failure/mockData";

export default function CouldNotDeliver() {
  const router = useRouter();

  return (
    <CouldNotDeliverScreen
      data={mockFailure}
      initialReason="blocked" // design preview only; remove so the driver starts with no selection
      onBack={() => router.back()}
      onOpenStop={() => console.log("open stop details")}
      onTakePhoto={() => {
        // TODO(feature/driver-pod-ui): open camera, compress the photo
        console.log("take photo");
      }}
      onSubmit={(payload) => {
        // TODO(feature/driver-sqlite + driver-sync): save to SQLite and queue an outbox event
        console.log("failed delivery", payload);
        router.navigate("/stops");
      }}
    />
  );
}