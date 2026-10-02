import { useRouter } from "expo-router";
import { DeliveryScreen } from "../../src/features/delivery/DeliveryScreen";
import { mockStop } from "../../src/features/delivery/mockData";

export default function RecordDelivery() {
  const router = useRouter();

  return (
    <DeliveryScreen
      data={mockStop}
      onComplete={(payload) => {
        // TODO(feature/driver-sqlite + driver-sync): save to SQLite, queue outbox event, go to POD capture
        console.log("complete delivery", payload);
      }}
      onCantDeliver={() => router.push("/could-not-deliver")}
    />
  );
}