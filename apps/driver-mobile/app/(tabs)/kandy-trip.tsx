import { useRouter } from "expo-router";
import { KandyTripScreen } from "../../src/features/kandytrip/KandyTripScreen";
import { mockKandyTrip } from "../../src/features/kandytrip/mockData";

export default function KandyTrip() {
  const router = useRouter();

  return (
    <KandyTripScreen
      data={mockKandyTrip}
      onViewSync={() => router.navigate("/sync")}
    />
  );
}