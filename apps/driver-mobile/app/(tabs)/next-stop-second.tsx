import { useRouter } from "expo-router";
import { NextStopScreen } from "../../src/features/nextstop/NextStopScreen";
import { mockNextStopSecond } from "../../src/features/nextstop/mockData";

export default function NextStopSecond() {
  const router = useRouter();

  return (
    <NextStopScreen
      data={mockNextStopSecond}
      onNavigate={() => {
        // TODO(integration): open the device maps app with the outlet coordinates
        console.log("navigate");
      }}
      onArrived={() => {
        // TODO(feature/driver-sqlite): store the arrival timestamp from the phone
        router.push("/record-delivery");
      }}
    />
  );
}