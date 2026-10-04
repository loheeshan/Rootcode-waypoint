import { View, Text, StyleSheet } from "react-native";
import { R } from "../../../theme/todayColors";

type Props = { tripCount: number; outletsTotal: number; dateLabel: string };

export function RunSheetHeader({ tripCount, outletsTotal, dateLabel }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Today's Run Sheet</Text>
        <Text style={styles.sub}>
          {tripCount} Scheduled Trips · {outletsTotal} Outlets Total
        </Text>
      </View>
      <View style={styles.date}>
        <Text style={styles.dateText}>{dateLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  title: { fontSize: 22, fontWeight: "800", color: R.text },
  sub: { fontSize: 13, color: R.muted, marginTop: 3 },
  date: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: R.dateChipBg,
  },
  dateText: { fontSize: 13, fontWeight: "800", color: R.primary },
});