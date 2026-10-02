import { DeliveryScreen } from "../../src/features/delivery/DeliveryScreen";
import { mockStop } from "../../src/features/delivery/mockData";

export default function Stops() {
  return (
    <DeliveryScreen
      data={mockStop}
      onComplete={(payload) => {
        // TODO(feature/driver-sqlite + driver-sync): save to SQLite, queue outbox event, go to POD capture
        console.log("complete delivery", payload);
      }}
      onCantDeliver={() => {
        // TODO: navigate to the R5 failed-delivery screen once it is designed
        console.log("can't deliver");
      }}
    />
  );
}