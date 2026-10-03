import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { X } from "../../../theme/closedColors";

type Props = {
  stopNo: number;
  stopTotal: number;
  outletCode: string;
  outletName: string;
  address: string;
  windowStart: string;
  windowEnd: string;
  eta: string;
  completedStops: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function ClosedHeroCard({
  stopNo,
  stopTotal,
  outletCode,
  outletName,
  address,
  windowStart,
  windowEnd,
  eta,
  completedStops,
}: Props) {
  const remaining = Math.max(stopTotal - stopNo, 0);

  return (
    <LinearGradient colors={[X.heroTop, X.heroBottom]} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.nextPill}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>
            NEXT · Stop {stopNo} of {stopTotal}
          </Text>
        </View>
        <Text style={styles.code}>{outletCode}</Text>
      </View>

      <Text style={styles.title}>{outletName}</Text>
      <View style={styles.addressRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={17} color="#5B8CFF" />
        <Text style={styles.address} numberOfLines={1}>
          {address}
        </Text>
      </View>

      <View style={styles.windowBox}>
        <View style={styles.clockCircle}>
          <MaterialCommunityIcons name="clock-time-four-outline" size={20} color={X.amber} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.windowLabel}>DELIVERY WINDOW</Text>
          <Text style={styles.windowValue}>
            {windowStart} – {windowEnd}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.windowLabel}>PLANNED ETA</Text>
          <Text style={styles.eta}>{eta}</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.muted}>Stop 01–{pad(completedStops)} Complete</Text>
        <View style={styles.activeChip}>
          <Text style={styles.activeText}>Stop {pad(stopNo)} Active</Text>
        </View>
        <Text style={styles.muted}>{remaining} Stops Remaining</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 24 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: X.primary,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  code: { color: "#8FA2E8", fontSize: 14, fontWeight: "700", letterSpacing: 0.4 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 16 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  address: { flex: 1, color: "#C4CCE8", fontSize: 14 },
  windowBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: X.glass,
    borderWidth: 1,
    borderColor: X.glassBorder,
  },
  clockCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(245,165,36,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  windowLabel: { color: "#A9B4DA", fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  windowValue: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 3 },
  eta: { color: X.eta, fontSize: 28, fontWeight: "800", marginTop: 1 },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: X.glassBorder,
  },
  muted: { color: "#A9B4DA", fontSize: 11.5, fontWeight: "600" },
  activeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: X.activeChip,
  },
  activeText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
});