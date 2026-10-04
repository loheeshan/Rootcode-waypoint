import { useRouter } from "expo-router";
import { TodayScreen } from "../../src/features/today/TodayScreen";
import { mockToday } from "../../src/features/today/mockData";

export default function Today() {
  const router = useRouter();

  return (
    <TodayScreen
      data={mockToday}
      onViewStops={() => router.navigate("/stops")}
    />
  );
}