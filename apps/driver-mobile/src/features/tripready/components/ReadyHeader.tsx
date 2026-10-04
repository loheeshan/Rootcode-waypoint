import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Y } from "../../../theme/readyColors";

type Props = { vehicle: string; depot: string; syncLabel: string };

export function ReadyHeader({ vehicle, depot, syncLabel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        <Text style={styles.brand}>Waypoint</Text>
        <View style={styles.sync}>
          <Text style={styles.syncText}>✓ {syncLabel}</Text>
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
    backgroundColor: Y.navy,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#fff", fontSize: 18, fontWeight: "800" },
  sync: {
    width: 180,
    height: 44,
    borderRadius: 22,
    backgroundColor: Y.pillBg,
    alignItems: "center",
    justifyContent: "center",
  },
  syncText: { color: Y.green, fontSize: 14, fontWeight: "800" },
  sub: { color: "#A9B4DA", fontSize: 12, fontWeight: "600", marginTop: 4 },
});