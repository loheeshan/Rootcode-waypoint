import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "../../../theme/tripColors";

type Props = { driverName: string; vehicle: string; syncLabel: string };

export function TripHeader({ driverName, vehicle, syncLabel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={styles.avatar}>
        {/* TODO: replace with the driver's profile photo */}
        <Ionicons name="person" size={22} color="#9FB0E8" />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{driverName}</Text>
          <View style={styles.vehicle}>
            <Text style={styles.vehicleText}>{vehicle}</Text>
          </View>
        </View>
        <Text style={styles.sub}>Waypoint Driver</Text>
      </View>

      <View style={styles.sync}>
        <View style={styles.syncDot} />
        <Text style={styles.syncText}>{syncLabel}</Text>
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
    backgroundColor: T.navy,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: "#fff", fontSize: 20, fontWeight: "800" },
  vehicle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  vehicleText: { color: "#D5DBF2", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  sub: { color: "#A9B4DA", fontSize: 13, marginTop: 2 },
  sync: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E3F7EA",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.green },
  syncText: { fontSize: 12, fontWeight: "700", color: T.green },
});