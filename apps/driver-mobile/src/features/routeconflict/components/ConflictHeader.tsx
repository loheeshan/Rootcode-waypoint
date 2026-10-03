import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { K } from "../../../theme/conflictColors";

type Props = { vehicle: string; depot: string; attentionCount: number };

export function ConflictHeader({ vehicle, depot, attentionCount }: Props) {
  const insets = useSafeAreaInsets();
  const label = attentionCount === 1 ? "1 needs attention" : `${attentionCount} need attention`;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        <Text style={styles.brand}>Waypoint</Text>
        <View style={styles.pill}>
          <MaterialCommunityIcons name="alert" size={14} color={K.pillText} />
          <Text style={styles.pillText}>{label}</Text>
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
    backgroundColor: K.pillBg,
  },
  pillText: { color: K.pillText, fontSize: 14, fontWeight: "800" },
  sub: { color: "#A9B4DA", fontSize: 12, fontWeight: "600", marginTop: 4 },
});