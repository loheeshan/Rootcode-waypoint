import { useRouter } from "expo-router";
import { TripCompleteScreen } from "../../src/features/tripcomplete/TripCompleteScreen";
import { mockTripComplete } from "../../src/features/tripcomplete/mockData";

export default function TripComplete() {
  const router = useRouter();

  return (
    <TripCompleteScreen
      data={mockTripComplete}
     onReviewRecords={() => router.push("/trip-records")}
      onViewSync={() => router.navigate("/sync")}
      onBackToToday={() => router.navigate("/today")}
    />
  );
}