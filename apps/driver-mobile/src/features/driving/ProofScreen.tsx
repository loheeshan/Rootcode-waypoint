import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TextInput } from 'react-native';

import { useAuth } from '../../services/auth';
import { colors } from '../../theme/tokens';
import { useDriverTrip } from './DriverTripProvider';
import { PodPhoto } from './PodPhoto';
import { capturePhoto, discardDraft, loadDraft, saveDraft, type PodDraft } from './podDraft';
import { Button, Card, DriverScreen, Notice, text } from './ui';

type CameraNotice = { tone: 'amber' | 'red'; title: string; body: string; settings?: boolean } | null;

/**
 * Proof of delivery as the API defines it: receiver name + one JPEG photo, uploaded with a stable
 * pod_id, then the stop is delivered with that pod_id. No signature is collected because the API
 * does not store one.
 */
export function ProofScreen() {
  const { stopId } = useLocalSearchParams<{ stopId?: string }>();
  // Hidden tab routes stay mounted; a fresh instance per stop keeps no data from the previous stop.
  return <ProofForm key={stopId ?? ''} stopId={stopId} />;
}

function ProofForm({ stopId }: { stopId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { tripId, detail, error, busy, loading, refresh, clearError, uploadPod, deliver } = useDriverTrip();
  const stop = detail?.stops.find((s) => s.stop_id === stopId);
  const [draft, setDraft] = useState<PodDraft | null>(null);
  const [receiver, setReceiver] = useState('');
  const [camera, setCamera] = useState<CameraNotice>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Resume a photo kept on the phone from an earlier attempt (e.g. after a failed upload or relaunch).
  useEffect(() => {
    if (!user || !stopId) return;
    let active = true;
    void loadDraft(user.id, stopId).then((saved) => {
      if (!active || (saved && saved.stopId !== stopId)) return;
      setDraft((current) => current ?? saved);
      if (saved) setReceiver((r) => r || saved.receiverName);
    });
    return () => { active = false; };
  }, [user, stopId]);

  useEffect(() => { clearError(); }, [clearError]);

  // Once the server holds proof for this stop, the local copy is not needed.
  const serverPod = stop && stop.status !== 'FAILED' ? stop.pod : null;
  useEffect(() => {
    if (serverPod && draft) {
      discardDraft(draft);
      setDraft(null);
    }
  }, [serverPod, draft]);

  if (!tripId || !detail || !stop || !user) {
    return (
      <DriverScreen title="Proof of delivery" refreshing={loading} onRefresh={refresh}>
        {error ? <Notice tone="red" title="Stop not loaded">{error}</Notice> : <Text style={text.muted}>Loading stop…</Text>}
        <Button variant="outline" label="Back to stops" onPress={() => router.navigate('/stops')} />
      </DriverScreen>
    );
  }

  const takePhoto = async () => {
    setCamera(null);
    setInvalid(null);
    setCapturing(true);
    const result = await capturePhoto();
    setCapturing(false);
    if (result.kind === 'denied') {
      setCamera(result.canAskAgain
        ? { tone: 'amber', title: 'Camera access needed', body: 'Allow camera access to photograph the delivered goods.' }
        : { tone: 'red', title: 'Camera permission denied', body: 'Turn on camera access for Waypoint Driver in system settings, then try again. A delivery cannot be confirmed without a photo.', settings: true });
      return;
    }
    if (result.kind === 'cancelled') {
      setCamera({ tone: 'amber', title: 'No photo taken', body: 'The camera was closed before a photo was taken.' });
      return;
    }
    if (result.kind === 'failed') {
      setCamera({ tone: 'red', title: 'Photo not usable', body: result.message });
      return;
    }
    // Saved at once so the photo survives a relaunch; a new photo always gets a new pod_id.
    setDraft(saveDraft(draft, {
      userId: user.id, stopId: stop.stop_id, receiverName: receiver.trim(),
      photoUri: result.uri, photoBytes: result.bytes, capturedAt: result.capturedAt,
    }));
  };

  const upload = async () => {
    const name = receiver.trim();
    if (!draft) return setInvalid('Take a photo of the delivered goods.');
    if (!name) return setInvalid('Enter the name of the person who received the goods.');
    if (name.length > 120) return setInvalid('Keep the receiver name to 120 characters.');
    setInvalid(null);
    const ready = saveDraft(draft, { ...draft, receiverName: name });
    setDraft(ready);
    if (await uploadPod(ready)) setDraft(null);
  };

  const discard = () => {
    if (draft) discardDraft(draft);
    setDraft(null);
  };

  const confirm = async () => {
    if (serverPod && await deliver(stop.stop_id, serverPod.pod_id)) router.navigate({ pathname: '/next-stop', params: { stopId: stop.stop_id } } as never);
  };

  const arrived = stop.status === 'ARRIVED' && detail.trip.status === 'IN_PROGRESS';

  return (
    <DriverScreen title={`Proof · stop ${stop.sequence_number}`} subtitle={stop.outlet_brand} refreshing={loading} onRefresh={refresh}>
      {error ? <Notice tone="red" title="Not saved">{error}</Notice> : null}
      {invalid ? <Notice tone="amber" title="Check the proof">{invalid}</Notice> : null}
      {stop.status === 'DELIVERED' ? <Notice tone="green" title="Delivered">This stop is already confirmed by the server.</Notice> : null}
      {stop.status === 'FAILED' ? <Notice tone="red" title="Not delivered">This stop was recorded as not delivered.</Notice> : null}
      {stop.status === 'PLANNED' ? <Notice tone="amber" title="Arrive first">Mark arrival at this stop before recording proof.</Notice> : null}

      {serverPod ? (
        <>
          <Card><PodPhoto tripId={tripId} pod={serverPod} /></Card>
          {arrived ? <Button label="Confirm delivered" loading={busy} onPress={() => void confirm()} /> : null}
        </>
      ) : arrived ? (
        <>
          <Text style={text.label}>Receiver name</Text>
          <TextInput
            style={styles.input}
            value={receiver}
            onChangeText={setReceiver}
            placeholder="Person who received the goods"
            maxLength={120}
            autoCapitalize="words"
            accessibilityLabel="Receiver name"
          />
          {camera ? (
            <Notice tone={camera.tone} title={camera.title}>{camera.body}</Notice>
          ) : null}
          {camera?.settings ? <Button variant="outline" label="Open settings" onPress={() => void Linking.openSettings()} /> : null}
          {draft ? (
            <Card>
              <Text style={text.label}>Photo on this phone (not uploaded yet)</Text>
              <Image source={{ uri: draft.photoUri }} style={styles.photo} resizeMode="cover" accessibilityLabel="Captured delivery photo" />
              <Text style={text.muted}>{Math.round(draft.photoBytes / 1024)} KB JPEG</Text>
            </Card>
          ) : null}
          <Button variant="outline" label={draft ? 'Retake photo' : 'Take photo'} loading={capturing} disabled={busy} onPress={() => void takePhoto()} />
          <Button label="Upload proof" loading={busy} disabled={capturing} onPress={() => void upload()} />
          {draft ? <Button variant="outline" label="Discard photo" disabled={busy || capturing} onPress={discard} /> : null}
        </>
      ) : null}
      <Button variant="outline" label="Back to stop" onPress={() => router.navigate({ pathname: '/next-stop', params: { stopId: stop.stop_id } } as never)} />
    </DriverScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12,
    padding: 12, fontSize: 16, color: colors.textPrimary,
  },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: colors.border },
});
