import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../theme/loaderTokens';

const DEMO_PIN = '0426';
const rows = [['0', '1', '2', '3', '4'], ['5', '6', '7', '8', '9']];

export function PinPad({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const press = (d: string) => {
    setError('');
    setPin((p) => (p.length < 4 ? p + d : p));
  };

  const submit = () => {
    if (pin.length < 4) return setError('Enter all 4 digits.');
    if (pin !== DEMO_PIN) {
      setPin('');
      return setError('Incorrect PIN. Try again.');
    }
    onSuccess();
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.bars}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.bar, i < pin.length && styles.barOn]} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {rows.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((d) => (
            <Pressable key={d} onPress={() => press(d)} style={({ pressed }) => [styles.key, pressed && { opacity: 0.6 }]}>
              <Text style={styles.keyText}>{d}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      <Pressable
        onPress={() => {
          setPin('');
          setError('');
        }}
        style={[styles.button, styles.secondary]}
      >
        <Text style={styles.buttonText}>Clear PIN</Text>
      </Pressable>
      <Pressable onPress={submit} style={[styles.button, styles.primary]}>
        <Text style={[styles.buttonText, { color: '#fff' }]}>Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  bar: { width: 28, height: 3, borderRadius: 2, backgroundColor: t.text },
  barOn: { backgroundColor: t.blue, height: 4 },
  error: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  key: {
    width: '17.6%', height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  keyText: { fontSize: 16, fontWeight: '800', color: t.text },
  button: { borderRadius: 12, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  secondary: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#fff' },
  primary: { backgroundColor: t.blue },
  buttonText: { fontSize: 16, fontWeight: '800', color: t.text },
});