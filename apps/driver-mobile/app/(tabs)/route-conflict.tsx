import { useRouter } from "expo-router";
import { RouteConflictScreen } from "../../src/features/routeconflict/RouteConflictScreen";
import { mockRouteConflict } from "../../src/features/routeconflict/mockData";

export default function RouteConflict() {
  const router = useRouter();

  return (
    <RouteConflictScreen
      data={mockRouteConflict}
      onAcknowledge={() => {
        // TODO(feature/driver-sync): mark the conflict as acknowledged on the phone
        router.navigate("/stops");
      }}
      onContactDispatcher={() => {
        // TODO: open the Contact dispatch popup
        console.log("contact dispatcher");
      }}
      onCheckPendingPhoto={() => router.push("/photo-attention")}
    />
  );
}