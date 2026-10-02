import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { D } from "../../../theme/deliveryColor";

type Props = {
  vehicle: string;
  routeName: string;
  offlineSaved: number;
  stopNo: number;
  stopTotal: number;
  outlet: string;
  dock: string;
};

export function DeliveryHeader({
  vehicle,
  routeName,
  offlineSaved,
  stopNo,
  stopTotal,
  outlet,
  dock,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Waypoint</Text>
          <Text style={styles.sub}>
            {vehicle} · {routeName}
          </Text>
        </View>
        <View style={styles.pill}>
          <View style={styles.dot} />
          <Text style={styles.pillText}>Offline · {offlineSaved} saved</Text>
        </View>
      </View>

      <View style={styles.strip}>
        <View style={styles.stopBadge}>
          <Text style={styles.stopBadgeText}>
            STOP {stopNo} OF {stopTotal}
          </Text>
        </View>
        <Text style={styles.outlet} numberOfLines={1}>
          {outlet}
        </Text>
        <Text style={styles.dock}>{dock}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: D.navy,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: D.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sub: { color: "#A9B4DA", fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E9ECF6",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.muted },
  pillText: { fontSize: 12, fontWeight: "700", color: D.navy },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: D.navyDeep,
  },
  stopBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: D.primary,
  },
  stopBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  outlet: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "800" },
  dock: { color: "#8C97C4", fontSize: 13, fontWeight: "600" },
});