import { View, Text, StyleSheet } from "react-native";
import { R } from "../../../theme/todayColors";

type Props = { stops: number; weightKg: number; volume: string };

const formatNumber = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function Cell({
  label,
  value,
  unit,
  divider,
}: {
  label: string;
  value: string;
  unit?: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.cell, divider && styles.divider]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </View>
    </View>
  );
}

export function TripStatsRow({ stops, weightKg, volume }: Props) {
  return (
    <View style={styles.box}>
      <Cell label="STOPS" value={String(stops)} />
      <Cell label="WEIGHT" value={formatNumber(weightKg)} unit="kg" divider />
      <Cell label="VOLUME" value={volume} unit="m³" divider />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: R.statBox,
    borderWidth: 1,
    borderColor: R.border,
  },
  cell: { flex: 1, paddingHorizontal: 14 },
  divider: { borderLeftWidth: 1, borderLeftColor: R.statDivider },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: "#6B7390" },
  valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  value: { fontSize: 24, fontWeight: "800", color: R.text },
  unit: { fontSize: 13, color: R.muted },
});