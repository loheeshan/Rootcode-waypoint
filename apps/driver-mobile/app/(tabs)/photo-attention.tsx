import { useRouter } from "expo-router";
import { PhotoAttentionScreen } from "../../src/features/photoattention/PhotoAttentionScreen";
import { mockPhotoAttention } from "../../src/features/photoattention/mockData";

export default function PhotoAttention() {
  const router = useRouter();

  return (
    <PhotoAttentionScreen
      data={mockPhotoAttention}
      onRetry={() => {
        // TODO(feature/driver-sync): retry the upload, show the Uploading photo popup meanwhile
        console.log("retry photo upload");
      }}
      onContinue={() => router.navigate("/stops")}
    />
  );
}