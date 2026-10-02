import { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { T } from "../../../theme/tripColors";

type Props = { label: string; children: ReactNode };

export function StatTile({ label, children }: Props) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: T.statBg,
    borderWidth: 1,
    borderColor: T.border,
  },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: "#6B7390" },
  valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
});