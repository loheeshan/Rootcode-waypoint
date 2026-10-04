import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { S } from "../../../theme/syncColors";

type Props = {
  corridor: string;
  offlineSince: string;
  offlineDuration: string;
  offlineRegion: string;
  signalText: string;
  signalPct: number;
  onRetry?: () => void;
};

export function DegradationCard({
  corridor,
  offlineSince,
  offlineDuration,
  offlineRegion,
  signalText,
  signalPct,
  onRetry,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.modePill}>
          <MaterialCommunityIcons name="cloud-off-outline" size={14} color={S.amber} />
          <Text style={styles.modeText}>Degradation Mode</Text>
        </View>
        <Text style={styles.corridor}>{corridor}</Text>
      </View>

      <Text style={styles.title}>
        Offline since {offlineSince}{" "}
        <Text style={styles.duration}>
          ({offlineDuration} in {offlineRegion})
        </Text>
      </Text>
      <Text style={styles.subtitle}>
        You can keep working. Everything is saved safely on this phone.
      </Text>

      <View style={styles.signalBox}>
        <MaterialCommunityIcons name="antenna" size={18} color="#8C97C4" />
        <Text style={styles.signalText}>{signalText}</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.signalPct}>{signalPct}%</Text>
          <Text style={styles.signalCell}>Cell</Text>
        </View>
      </View>

      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
      >
        <MaterialCommunityIcons name="sync" size={18} color="#fff" />
        <Text style={styles.ctaText}>Try Again Now (Check Cellular Signal)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: S.panel,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  modeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  corridor: { color: "#8C97C4", fontSize: 12, fontWeight: "600" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 18 },
  duration: { color: S.amber, fontSize: 14, fontWeight: "600" },
  subtitle: { color: "#A9B4DA", fontSize: 14, lineHeight: 20, marginTop: 6 },
  signalBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: S.signalBox,
  },
  signalText: { flex: 1, color: "#C4CCE8", fontSize: 13, lineHeight: 18 },
  signalPct: { color: "#8C97C4", fontSize: 13, fontWeight: "800" },
  signalCell: { color: "#8C97C4", fontSize: 11, fontWeight: "600" },
  cta: {
    marginTop: 16,
    height: 52,
    borderRadius: 12,
    backgroundColor: S.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});