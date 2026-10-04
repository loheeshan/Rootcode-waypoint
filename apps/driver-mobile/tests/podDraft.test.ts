import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-ins for the native modules podDraft.ts uses.
const files = new Map<string, { text: string; size: number }>();
let uuid = 0;
const picker = { granted: true, canAskAgain: true, result: { canceled: false, assets: [{ uri: 'cache://shot.jpg', width: 4000 }] } as unknown };
// Encoded size per resize width; tests change it to force more compression.
let sizeForWidth: (width: number | null) => number = () => 400_000;

vi.mock('expo-crypto', () => ({ randomUUID: () => `id-${++uuid}` }));
vi.mock('expo-file-system', () => {
  const join = (parts: unknown[]) => parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get exists() { return true; }
    create() {}
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.size ?? 0; }
    delete() { files.delete(this.uri); }
    write(text: string) { files.set(this.uri, { text, size: text.length }); }
    async text() { return files.get(this.uri)!.text; }
    copySync(to: File) { files.set(to.uri, { ...files.get(this.uri)! }); }
    async base64() { return 'BASE64'; }
  }
  return { Directory, File, Paths: { document: new Directory('doc') } };
});
vi.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => {
      let width: number | null = null;
      const context = {
        resize: (size: { width: number }) => { width = size.width; return context; },
        renderAsync: async () => ({
          saveAsync: async () => {
            const uri = `cache://out-${++uuid}.jpg`;
            files.set(uri, { text: '', size: sizeForWidth(width) });
            return { uri };
          },
        }),
      };
      return context;
    },
  },
}));
vi.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: picker.granted, canAskAgain: picker.canAskAgain }),
  launchCameraAsync: async () => picker.result,
}));

const { MAX_POD_BYTES, capturePhoto, discardDraft, loadDraft, saveDraft } = await import('../src/features/driving/podDraft');

const base = { userId: 'driver-1', stopId: 'stop-1', receiverName: 'Nimal', photoUri: 'doc/pod-drafts/a.jpg', photoBytes: 10, capturedAt: '2026-10-04T10:00:00Z' };

beforeEach(() => {
  files.clear();
  uuid = 0;
  sizeForWidth = () => 400_000;
  picker.granted = true;
  picker.canAskAgain = true;
  picker.result = { canceled: false, assets: [{ uri: 'cache://shot.jpg', width: 4000 }] };
  files.set('cache://shot.jpg', { text: '', size: 5_000_000 });
});

describe('POD drafts', () => {
  it('keeps the pod_id for an identical retry and issues a new one when the proof changes', () => {
    files.set(base.photoUri, { text: '', size: 10 });
    const first = saveDraft(null, base);
    expect(saveDraft(first, base).podId).toBe(first.podId);
    expect(saveDraft(first, { ...base, receiverName: 'Kamal' }).podId).not.toBe(first.podId);
  });

  it('deletes the replaced photo when the driver retakes it', () => {
    files.set(base.photoUri, { text: '', size: 10 });
    files.set('doc/pod-drafts/b.jpg', { text: '', size: 10 });
    const first = saveDraft(null, base);
    const second = saveDraft(first, { ...base, photoUri: 'doc/pod-drafts/b.jpg' });
    expect(second.podId).not.toBe(first.podId);
    expect(files.has(base.photoUri)).toBe(false);
  });

  it('reloads a saved draft after relaunch but drops another account\'s draft', async () => {
    files.set(base.photoUri, { text: '', size: 10 });
    const saved = saveDraft(null, base);
    expect(await loadDraft('driver-1', 'stop-1')).toEqual(saved);
    expect(await loadDraft('driver-2', 'stop-1')).toBeNull();
    expect(files.has(base.photoUri)).toBe(false);
  });

  it('discards the photo and record together', async () => {
    files.set(base.photoUri, { text: '', size: 10 });
    discardDraft(saveDraft(null, base));
    expect([...files.keys()].filter((k) => k.startsWith('doc/'))).toEqual([]);
    expect(await loadDraft('driver-1', 'stop-1')).toBeNull();
  });
});

describe('capturePhoto', () => {
  it('reports denied and cancelled states without a photo', async () => {
    picker.granted = false;
    picker.canAskAgain = false;
    expect(await capturePhoto()).toEqual({ kind: 'denied', canAskAgain: false });
    picker.granted = true;
    picker.result = { canceled: true, assets: null };
    expect(await capturePhoto()).toEqual({ kind: 'cancelled' });
  });

  it('shrinks until the JPEG fits the backend limit and removes the camera original', async () => {
    sizeForWidth = (width) => (width && width <= 1024 ? 600_000 : 1_200_000);
    const result = await capturePhoto();
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.bytes).toBeLessThanOrEqual(MAX_POD_BYTES);
    expect(result.uri.startsWith('doc/pod-drafts/')).toBe(true);
    expect(files.has('cache://shot.jpg')).toBe(false);
    expect([...files.keys()].filter((k) => k.startsWith('cache://'))).toEqual([]);
  });

  it('fails clearly when no size fits', async () => {
    sizeForWidth = () => MAX_POD_BYTES + 1;
    const result = await capturePhoto();
    expect(result.kind).toBe('failed');
  });
});
