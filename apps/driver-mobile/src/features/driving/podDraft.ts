import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Backend limit for the decoded photo (MAX_POD_BYTES in apps/api/app/delivery/models.py). */
export const MAX_POD_BYTES = 1_000_000;

/**
 * Proof of delivery waiting to be uploaded for one stop. The photo and this record live in the
 * app's document directory, so they survive a relaunch, and the same pod_id, receiver, photo and
 * capture time are re-sent on every retry (the server applies a pod_id once).
 */
export type PodDraft = {
  userId: string;
  stopId: string;
  podId: string;
  receiverName: string;
  photoUri: string;
  photoBytes: number;
  capturedAt: string;
};

export type CaptureResult =
  | { kind: 'ok'; uri: string; bytes: number; capturedAt: string }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

const folder = () => {
  const dir = new Directory(Paths.document, 'pod-drafts');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};
const record = (stopId: string) => new File(folder(), `${stopId}.json`);

function remove(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone; nothing to clean up.
  }
}

// Largest first; stop at the first JPEG that fits the backend limit.
const ATTEMPTS: [number, number][] = [[1600, 0.7], [1280, 0.6], [1024, 0.5], [800, 0.4]];

/** Re-encode as JPEG, shrinking only as far as needed to fit MAX_POD_BYTES. */
async function fitToLimit(source: string, width: number): Promise<{ uri: string; bytes: number }> {
  for (const [maxWidth, compress] of ATTEMPTS) {
    const context = ImageManipulator.manipulate(source);
    if (!width || width > maxWidth) context.resize({ width: maxWidth });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG });
    const file = new File(saved.uri);
    const bytes = file.size;
    if (bytes > 0 && bytes <= MAX_POD_BYTES) {
      const durable = new File(folder(), `${randomUUID()}.jpg`);
      file.copySync(durable);
      remove(saved.uri);
      return { uri: durable.uri, bytes };
    }
    remove(saved.uri);
  }
  throw new Error('The photo is still too large after compression. Take it again closer to the goods.');
}

/** Ask for camera access, take one photo and keep a contract-sized JPEG copy on the device. */
export async function capturePhoto(): Promise<CaptureResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { kind: 'denied', canAskAgain: permission.canAskAgain };
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
  } catch {
    return { kind: 'failed', message: 'The camera could not be opened on this device.' };
  }
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return { kind: 'cancelled' };
  const capturedAt = new Date().toISOString();
  try {
    const { uri, bytes } = await fitToLimit(asset.uri, asset.width);
    return { kind: 'ok', uri, bytes, capturedAt };
  } catch (error) {
    return { kind: 'failed', message: error instanceof Error ? error.message : 'The photo could not be prepared.' };
  } finally {
    remove(asset.uri);
  }
}

/** Load this user's draft for a stop; drafts left by another account are deleted. */
export async function loadDraft(userId: string, stopId: string): Promise<PodDraft | null> {
  try {
    const file = record(stopId);
    if (!file.exists) return null;
    const draft = JSON.parse(await file.text()) as PodDraft;
    if (draft.userId !== userId || draft.stopId !== stopId || !new File(draft.photoUri).exists) {
      discardDraft(draft);
      file.delete();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

/** Persist a draft. A new pod_id is issued whenever the receiver or photo changes. */
export function saveDraft(previous: PodDraft | null, next: Omit<PodDraft, 'podId'>): PodDraft {
  const same = previous && previous.receiverName === next.receiverName && previous.photoUri === next.photoUri;
  const draft: PodDraft = { ...next, podId: same ? previous.podId : randomUUID() };
  if (previous && previous.photoUri !== draft.photoUri) remove(previous.photoUri);
  record(draft.stopId).write(JSON.stringify(draft));
  return draft;
}

/** Delete a draft's photo and record (after upload, or when the driver discards it). */
export function discardDraft(draft: Pick<PodDraft, 'stopId' | 'photoUri'>): void {
  remove(draft.photoUri);
  try {
    const file = record(draft.stopId);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

/** Delete a photo that never became part of a saved draft. */
export const discardPhoto = (uri: string) => remove(uri);

export const readBase64 = (uri: string) => new File(uri).base64();
