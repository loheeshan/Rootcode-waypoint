import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { N } from "../../../theme/nextStopColors";

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
  variant?: "range" | "recorded";
};

const pad = (n: number) => String(n).padStart(2, "0");

export function StopHeroCard({
  stopNo,
  stopTotal,
  outletCode,
  outletName,
  address,
  windowStart,
  windowEnd,
  eta,
  completedStops,
  variant = "range",
}: Props) {
  const remaining = Math.max(stopTotal - stopNo, 0);
  const isLast = stopNo >= stopTotal;

  const labels =
    variant === "recorded"
      ? {
          left: `${completedStops} recorded`,
          mid: `Stop ${stopNo}`,
          right: isLast ? "Final stop" : `${remaining} remaining`,
        }
      : {
          left:
            completedStops > 0
              ? `Stop 01–${pad(completedStops)} Complete`
              : "No stops complete",
          mid: `Stop ${pad(stopNo)} Active`,
          right: isLast ? "Final stop" : `${remaining} Stops Remaining`,
        };

  return (
    <LinearGradient colors={[N.heroTop, N.heroBottom]} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.nextPill}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>
            {isLast ? "LAST" : "NEXT"} · Stop {stopNo} of {stopTotal}
          </Text>
        </View>
        <Text style={styles.code}>{outletCode}</Text>
      </View>

      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {outletName}
      </Text>
      <View style={styles.addressRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={18} color="#8C97C4" />
        <Text style={styles.address} numberOfLines={1}>
          {address}
        </Text>
      </View>

      <View style={styles.windowBox}>
        <View style={styles.clockRing}>
          <MaterialCommunityIcons name="clock-outline" size={20} color={N.amber} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.windowLabel}>Delivery Window</Text>
          <Text style={styles.windowValue}>
            {windowStart} – {windowEnd}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.windowLabel}>Planned ETA</Text>
          <Text style={styles.eta}>{eta}</Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressMuted}>{labels.left}</Text>
          <Text style={styles.progressActive}>{labels.mid}</Text>
          <Text style={styles.progressMuted}>{labels.right}</Text>
        </View>

        {variant === "recorded" ? (
          <View style={styles.bar} />
        ) : (
          <View style={styles.bar}>
            <View style={{ flex: Math.max(completedStops, 0), backgroundColor: "#4C6FF0" }} />
            <View style={{ flex: 1, backgroundColor: "#fff" }} />
            <View style={{ flex: Math.max(remaining, 0) }} />
          </View>
        )}
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
    backgroundColor: N.primary,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  code: { color: "#8C97C4", fontSize: 13, fontWeight: "700" },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 16 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  address: { flex: 1, color: "#A9B4DA", fontSize: 15 },
  windowBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: N.glass,
    borderWidth: 1,
    borderColor: N.glassBorder,
  },
  clockRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: N.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  windowLabel: { color: "#A9B4DA", fontSize: 13, fontWeight: "600" },
  windowValue: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 },
  eta: { color: N.eta, fontSize: 30, fontWeight: "800", marginTop: 0 },
  progressWrap: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: N.glassBorder,
  },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressMuted: { color: "#8C97C4", fontSize: 11, fontWeight: "600" },
  progressActive: { color: "#fff", fontSize: 11, fontWeight: "800" },
  bar: {
    flexDirection: "row",
    height: 6,
    marginTop: 8,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});