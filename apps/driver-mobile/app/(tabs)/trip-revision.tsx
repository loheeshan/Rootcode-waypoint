import { useRouter } from "expo-router";
import { TripRevisionScreen } from "../../src/features/triprevision/TripRevisionScreen";
import { mockTripRevision } from "../../src/features/triprevision/mockData";

export default function TripRevision() {
  const router = useRouter();

  return (
    <TripRevisionScreen
      data={mockTripRevision}
      onContinue={() => router.push("/next-stop")}
      onStopPress={(stop) => {
        // TODO: open a read-only stop detail for finished stops
        if (stop.status === "current") router.push("/next-stop");
        else console.log("open stop", stop.id);
      }}
    />
  );
}