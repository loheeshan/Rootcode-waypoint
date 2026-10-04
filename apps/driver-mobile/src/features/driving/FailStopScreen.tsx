import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import type { DeliveryFailureReason } from '@waypoint/api-contracts';

import { colors } from '../../theme/tokens';
import { useDriverTrip } from './DriverTripProvider';
import { FAILURE_REASONS } from './format';
import { Button, DriverScreen, Notice, text } from './ui';

/** Record that a stop could not be delivered: one backend reason code and a required note. */
export function FailStopScreen() {
  const { stopId } = useLocalSearchParams<{ stopId?: string }>();
  // Hidden tab routes stay mounted; a fresh instance per stop keeps no reason or note from another stop.
  return <FailForm key={stopId ?? ''} stopId={stopId} />;
}

function FailForm({ stopId }: { stopId?: string }) {
  const router = useRouter();
  const { detail, error, busy, loading, refresh, clearError, fail } = useDriverTrip();
  const stop = detail?.stops.find((s) => s.stop_id === stopId);
  const [reason, setReason] = useState<DeliveryFailureReason | null>(null);
  const [note, setNote] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  useEffect(() => { clearError(); }, [clearError]);

  if (!detail || !stop) {
    return (
      <DriverScreen title="Could not deliver" refreshing={loading} onRefresh={refresh}>
        {error ? <Notice tone="red" title="Stop not loaded">{error}</Notice> : <Text style={text.muted}>Loading stop…</Text>}
        <Button variant="outline" label="Back to stops" onPress={() => router.navigate('/stops')} />
      </DriverScreen>
    );
  }

  const open = detail.trip.status === 'IN_PROGRESS' && (stop.status === 'PLANNED' || stop.status === 'ARRIVED');

  const submit = async () => {
    if (!reason) return setInvalid('Choose why the stop could not be delivered.');
    if (!note.trim()) return setInvalid('Add a note for the dispatcher.');
    setInvalid(null);
    if (await fail(stop.stop_id, reason, note.trim())) router.navigate({ pathname: '/next-stop', params: { stopId: stop.stop_id } } as never);
  };

  return (
    <DriverScreen title={`Could not deliver · stop ${stop.sequence_number}`} subtitle={stop.outlet_brand} refreshing={loading} onRefresh={refresh}>
      {error ? <Notice tone="red" title="Not saved">{error}</Notice> : null}
      {invalid ? <Notice tone="amber" title="Check the report">{invalid}</Notice> : null}
      {!open ? <Notice tone="amber" title="Stop already closed">This stop already has an outcome or the trip is not on route.</Notice> : null}
      <Text style={text.muted}>The orders stay out for delivery; the dispatcher decides what happens next.</Text>

      <Text style={text.label}>Reason</Text>
      {FAILURE_REASONS.map(([code, label]) => (
        <Pressable key={code} onPress={() => setReason(code)} accessibilityRole="radio"
          accessibilityState={{ selected: reason === code }} style={[styles.option, reason === code && styles.optionOn]}>
          <Text style={text.body}>{label}</Text>
        </Pressable>
      ))}

      <Text style={text.label}>Note (required)</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} multiline maxLength={500}
        placeholder="What happened at the outlet?" accessibilityLabel="Failure note" />
      {open ? <Button variant="danger" label="Record not delivered" loading={busy} onPress={() => void submit()} /> : null}
      <Button variant="outline" label="Back" onPress={() => router.navigate({ pathname: '/next-stop', params: { stopId: stop.stop_id } } as never)} />
    </DriverScreen>
  );
}

const styles = StyleSheet.create({
  option: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14 },
  optionOn: { borderColor: colors.primary, borderWidth: 2 },
  input: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12,
    padding: 12, minHeight: 90, fontSize: 15, color: colors.textPrimary, textAlignVertical: 'top',
  },
});
