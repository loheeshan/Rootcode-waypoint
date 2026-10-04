import { View, Text, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { R } from "../../../theme/todayColors";

type Props = {
  greeting: string;
  syncLabel: string;
  vehicle: string;
  vehicleType: string;
  tempC: string;
  tempLocked: boolean;
};

export function TodayHeader({
  greeting,
  syncLabel,
  vehicle,
  vehicleType,
  tempC,
  tempLocked,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          {/* TODO: replace with the driver's profile photo */}
          <Ionicons name="person" size={24} color="#9FB0E8" />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.brand}>Waypoint</Text>
            <View style={styles.liveDot} />
          </View>
          <Text style={styles.greeting}>{greeting}</Text>
        </View>

        <View style={styles.sync}>
          <View style={styles.syncDot} />
          <Text style={styles.syncText}>{syncLabel}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.vehicleRow}>
        <View style={styles.vehicleChip}>
          <Text style={styles.vehicleChipText}>VEHICLE</Text>
        </View>
        <Text style={styles.vehicleText} numberOfLines={1}>
          {vehicle} · {vehicleType}
        </Text>
        <View style={styles.tempRow}>
          <MaterialCommunityIcons name="thermometer" size={16} color="#8FA2E8" />
          <Text style={styles.temp}>{tempC}</Text>
          {tempLocked ? <Text style={styles.locked}>LOCKED</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: R.navy,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { color: "#fff", fontSize: 24, fontWeight: "800" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2ED47A" },
  greeting: { color: "#A9B4DA", fontSize: 14, marginTop: 1 },
  sync: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#E3F7EA",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: R.green },
  syncText: { fontSize: 13, fontWeight: "700", color: R.green },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginTop: 14,
  },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  vehicleChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  vehicleChipText: { color: "#C4CCE8", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  vehicleText: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "700" },
  tempRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  temp: { color: "#2ED47A", fontSize: 15, fontWeight: "800" },
  locked: { color: "#2ED47A", fontSize: 11, fontWeight: "800", marginLeft: 2 },
});