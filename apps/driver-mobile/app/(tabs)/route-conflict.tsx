import { useRouter } from "expo-router";
import { RouteConflictScreen } from "../../src/features/routeconflict/RouteConflictScreen";
import { mockRouteConflict } from "../../src/features/routeconflict/mockData";

export default function RouteConflict() {
  const router = useRouter();

  return (
    <RouteConflictScreen
      data={mockRouteConflict}
      onAcknowledge={() => router.push("/kandy-trip")}
      onContactDispatcher={() => {
        // TODO: open the Contact dispatch popup
        console.log("contact dispatcher");
      }}
      onCheckPendingPhoto={() => router.push("/photo-attention")}
    />
  );
}