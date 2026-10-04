import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { K } from "../../../theme/conflictColors";

type Props = { vehicle: string; depot: string; pillLabel: string };

export function DownloadHeader({ vehicle, depot, pillLabel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        <Text style={styles.brand}>Waypoint</Text>
        <View style={styles.pill}>
          <View style={styles.dot} />
          <Text style={styles.pillText}>{pillLabel}</Text>
        </View>
      </View>
      <Text style={styles.sub}>
        {vehicle} · {depot}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: K.navy,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#fff", fontSize: 18, fontWeight: "800" },
  pill: {
    width: 180,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 22,
    backgroundColor: "#F1F3F9",
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#6B7390" },
  pillText: { color: "#4A5478", fontSize: 14, fontWeight: "800" },
  sub: { color: "#A9B4DA", fontSize: 12, fontWeight: "600", marginTop: 4 },
});