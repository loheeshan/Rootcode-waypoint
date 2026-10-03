// src/components/ui/StatusBanner.tsx
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title?: string;
  message: string;
  stacked?: boolean; // title on its own line (Checklist style)
  boxedIcon?: boolean; // icon in a small square (Checklist style)
  icon?: keyof typeof Ionicons.glyphMap;
};

export function StatusBanner({
  title,
  message,
  stacked,
  boxedIcon,
  icon = 'cloud-offline-outline',
}: Props) {
  return (
    <View style={styles.wrap}>
      {boxedIcon ? (
        <View style={styles.box}>
          <Ionicons name={icon} size={18} color="#475569" />
        </View>
      ) : (
        <Ionicons name={icon} size={18} color="#64748B" />
      )}
      <View style={{ flex: 1 }}>
        {stacked ? (
          <>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Text style={styles.msg}>{message}</Text>
          </>
        ) : (
          <Text style={styles.msg}>
            {title ? <Text style={styles.title}>{title} </Text> : null}
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EEF2F7',
    borderWidth: 1,
    borderColor: '#D5DCE6',
    borderRadius: 12,
    padding: 12,
  },
  box: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#DDE3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '700', color: '#334155' },
  msg: { fontSize: 13, color: '#475569', lineHeight: 18 },
});