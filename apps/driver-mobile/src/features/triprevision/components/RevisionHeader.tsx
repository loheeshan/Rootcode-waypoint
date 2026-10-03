import { View, Text, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { V } from "../../../theme/revisionColors";

type Props = { driverName: string; vehicle: string; syncLabel: string };

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function RevisionHeader({ driverName, vehicle, syncLabel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.avatar}>
        {/* TODO: replace with the driver's profile photo */}
        <Ionicons name="person" size={24} color="#9FB0E8" />
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
    backgroundColor: V.headerBg,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2A3566",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: "#fff", fontSize: 17, fontWeight: "800" },
  vehicle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  vehicleText: { color: "#D5DBF2", fontSize: 11, fontFamily: MONO, fontWeight: "700" },
  sub: { color: "#A9B4DA", fontSize: 13, marginTop: 3 },
  sync: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2ED47A" },
  syncText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});