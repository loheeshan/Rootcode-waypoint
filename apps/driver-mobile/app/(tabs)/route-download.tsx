import { useRouter } from "expo-router";
import { RouteDownloadScreen } from "../../src/features/routedownload/RouteDownloadScreen";
import { mockRouteDownload } from "../../src/features/routedownload/mockData";

export default function RouteDownload() {
  const router = useRouter();

  return (
    <RouteDownloadScreen
      data={mockRouteDownload}
      onRetry={() => {
        // TODO(feature/driver-sync): restart the route download
        console.log("retry download");
      }}
      onUseSaved={() => router.navigate("/today")}
    />
  );
}