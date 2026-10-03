import { useRouter } from "expo-router";
import { TripCompleteScreen } from "../../src/features/tripcomplete/TripCompleteScreen";
import { mockTripComplete } from "../../src/features/tripcomplete/mockData";

export default function TripComplete() {
  const router = useRouter();

  return (
    <TripCompleteScreen
      data={mockTripComplete}
      onReviewRecords={() => {
        // TODO: open the trip records list once it is designed
        console.log("review trip records");
      }}
      onViewSync={() => router.navigate("/sync")}
      onBackToToday={() => router.navigate("/today")}
    />
  );
}