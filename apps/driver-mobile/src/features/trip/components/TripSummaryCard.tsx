import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { T } from "../../../theme/tripColors";
import { StatTile } from "./StatTile";

type Props = {
  tripLabel: string;
  routeName: string;
  status: string;
  completed: number;
  total: number;
  cargoKg: number;
  cargoVolume: string;
  onContinue?: () => void;
};

const formatNumber = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function TripSummaryCard({
  tripLabel,
  routeName,
  status,
  completed,
  total,
  cargoKg,
  cargoVolume,
  onContinue,
}: Props) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.kickerRow}>
          <MaterialCommunityIcons name="routes" size={16} color="#6B7390" />
          <Text style={styles.kicker}>COMMERCIAL ROUTE</Text>
        </View>
        <View style={styles.status}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <Text style={styles.title}>
        {tripLabel} · {routeName}
      </Text>

      <View style={styles.stats}>
        <StatTile label="COMPLETION">
          <Text style={styles.big}>
            {completed}/{total}
          </Text>
          <Text style={styles.unit}> stops</Text>
        </StatTile>
        <StatTile label="CARGO ONBOARD">
          <Text style={styles.big}>{formatNumber(cargoKg)}</Text>
          <Text style={styles.unit}> kg / {cargoVolume}</Text>
        </StatTile>
      </View>

      <View style={styles.progressHead}>
        <Text style={styles.progressLabel}>Progress</Text>
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>

      <Pressable
        onPress={onContinue}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="navigate-outline" size={18} color="#fff" />
        <Text style={styles.ctaText}>Continue Trip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: "#6B7390" },
  status: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: T.activeChipBg,
  },
  statusText: { fontSize: 12, fontWeight: "800", color: T.primary },
  title: { fontSize: 24, fontWeight: "800", lineHeight: 30, color: T.text, marginTop: 8 },
  stats: { flexDirection: "row", gap: 12, marginTop: 16 },
  big: { fontSize: 24, fontWeight: "800", color: T.text },
  unit: { fontSize: 13, color: T.muted },
  progressHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 6,
  },
  progressLabel: { fontSize: 14, color: "#5B6485" },
  progressPct: { fontSize: 14, fontWeight: "800", color: T.primary },
  track: { height: 10, borderRadius: 5, backgroundColor: T.progressTrack, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5, backgroundColor: T.primary },
  cta: {
    marginTop: 16,
    height: 54,
    borderRadius: 14,
    backgroundColor: T.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});