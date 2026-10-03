import { PhotoAttentionSnapshot } from "./types";

// TODO(feature/driver-sync): replace with the proof photos still waiting in the outbox
export const mockPhotoAttention: PhotoAttentionSnapshot = {
  vehicle: "VEH018",
  depot: "Kandy Fresh",
  photos: [
    {
      id: "p1",
      fileName: "POD_OUT091_01.jpg",
      stopNo: 5,
      outlet: "OUT091",
      capturedAt: "06:41",
    },
  ],
};