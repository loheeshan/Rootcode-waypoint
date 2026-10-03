import { View, Text, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Z } from "../../../theme/reeferColors";

type Props = {
  greeting: string;
  syncLabel: string;
  vehicle: string;
  vehicleType: string;
  tempC: string;
  tempStatus: string;
};

export function ReeferHeader({
  greeting,
  syncLabel,
  vehicle,
  vehicleType,
  tempC,
  tempStatus,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          {/* TODO: replace with the driver's profile photo */}
          <Ionicons name="person" size={26} color="#9FB0E8" />
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

      <View style={styles.strip}>
        <View style={styles.vehicleChip}>
          <Text style={styles.vehicleChipText}>VEHICLE</Text>
        </View>

        <Text style={styles.vehicleText}>
          {vehicle} · {vehicleType}
        </Text>

        <View style={styles.tempRow}>
          <MaterialCommunityIcons name="thermometer" size={18} color={Z.critical} />
          <Text style={styles.temp}>{tempC}</Text>
        </View>

        <View style={styles.critical}>
          <Text style={styles.criticalText}>{tempStatus.replace(" / ", " /\n")}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: Z.headerBg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#2A3566",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { color: "#fff", fontSize: 18, fontWeight: "800" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2ED47A" },
  greeting: { color: "#C4CCE8", fontSize: 13, marginTop: 3 },
  sync: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(46,212,122,0.12)",
    borderWidth: 1,
    borderColor: "rgba(46,212,122,0.55)",
  },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#2ED47A" },
  syncText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },

  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Z.stripBg,
    borderWidth: 1,
    borderColor: Z.stripBorder,
  },
  vehicleChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: Z.vehicleChip,
  },
  vehicleChipText: { color: "#E4E9FB", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6 },
  vehicleText: { flex: 1, color: "#fff", fontSize: 13, lineHeight: 18 },
  tempRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  temp: { color: Z.critical, fontSize: 13, fontWeight: "800" },
  critical: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Z.criticalBg,
    borderWidth: 1,
    borderColor: Z.criticalBorder,
  },
  criticalText: { color: Z.critical, fontSize: 10, fontWeight: "800", lineHeight: 13 },
});