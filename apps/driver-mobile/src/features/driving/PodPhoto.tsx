import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { PodResponse } from '@waypoint/api-contracts';

import { apiUrl } from '../../services/api';
import { session } from '../../services/session';
import { colors } from '../../theme/tokens';
import { colomboTime } from './format';
import { text } from './ui';

/** Proof of delivery as stored on the server, with the photo read back from GET .../pod. */
export function PodPhoto({ tripId, pod }: { tripId: string; pod: PodResponse }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // React Native's Image cannot send the bearer token on Android, so download the server copy
  // with the token into the cache and show that file.
  useEffect(() => {
    let active = true;
    setFailed(false);
    void (async () => {
      try {
        const token = await session.getToken();
        const dir = new Directory(Paths.cache, 'pod-view');
        if (!dir.exists) dir.create({ intermediates: true });
        const target = new File(dir, `${pod.pod_id}.${pod.photo_mime_type === 'image/png' ? 'png' : 'jpg'}`);
        const file = await File.downloadFileAsync(`${apiUrl()}/trips/${tripId}/stops/${pod.stop_id}/pod`, target, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          idempotent: true,
        });
        if (active) setUri(file.uri);
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => { active = false; };
  }, [tripId, pod.stop_id, pod.pod_id, pod.photo_mime_type]);

  return (
    <View style={styles.box}>
      <Text style={text.label}>Proof of delivery (saved on the server)</Text>
      <Text style={text.body}>Received by {pod.receiver_name}</Text>
      <Text style={text.muted}>
        Uploaded {colomboTime(pod.uploaded_at)} · {Math.round(pod.photo_size_bytes / 1024)} KB {pod.photo_mime_type === 'image/png' ? 'PNG' : 'JPEG'}
      </Text>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel={`Delivery photo received by ${pod.receiver_name}`}
          onError={() => setFailed(true)}
        />
      ) : null}
      {failed ? <Text style={[text.muted, { color: colors.dangerText }]}>The photo could not be loaded. Pull to refresh.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: colors.border, marginTop: 6 },
});
