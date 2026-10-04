export type PendingPhoto = {
  id: string;
  fileName: string; // e.g. "POD_OUT091_01.jpg"
  stopNo: number;
  outlet: string; // e.g. "OUT091"
  capturedAt: string; // phone capture time, e.g. "06:41"
};

export type PhotoAttentionSnapshot = {
  vehicle: string;
  depot: string; // e.g. "Kandy Fresh"
  photos: PendingPhoto[];
};