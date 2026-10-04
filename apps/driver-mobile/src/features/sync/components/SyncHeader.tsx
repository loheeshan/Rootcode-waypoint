import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { S } from "../../../theme/syncColors";

type Props = { vehicle: string; depot: string; offlineCount: number };

export function SyncHeader({ vehicle, depot, offlineCount }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={22} color="#9FB0E8" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>Waypoint</Text>
        <Text style={styles.sub}>
          {vehicle} · {depot}
        </Text>
      </View>

      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.pillText}>Offline · {offlineCount} saved</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: S.navy,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sub: { color: "#A9B4DA", fontSize: 11, fontWeight: "600" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E9ECF6",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#7A839E" },
  pillText: { fontSize: 12, fontWeight: "700", color: S.navy },
});