// src/features/today/components/LockedNotice.tsx
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export function LockedNotice() {
  return (
    <View style={styles.wrap}>
      <Ionicons name="lock-closed-outline" size={14} color="#64748B" />
      <Text style={styles.text}>TRIPS LOCKED PENDING DEPOT CONFIRMATION</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#E5E9F0', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
  },
  text: { fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.4 },
});