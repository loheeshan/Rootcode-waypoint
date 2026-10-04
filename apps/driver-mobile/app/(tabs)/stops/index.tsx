import { useRouter } from "expo-router";
import { TripScreen } from "../../../src/features/trip/TripScreen";
import { mockTrip } from "../../../src/features/trip/mockData";

export default function Stops() {
  const router = useRouter();

  return (
    <TripScreen
      data={mockTrip}
      onContinue={() => router.push("/next-stop")}
      onStopPress={(stop) => {
        // TODO: open a read-only stop detail for finished stops
        if (stop.status === "current") router.push("/next-stop");
        else console.log("open stop", stop.id);
      }}
    />
  );
}