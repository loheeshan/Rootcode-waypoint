import { View, Text, Platform, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { O } from "../../../theme/offlineLaunchColors";

type Props = {
  statusText: string;
  progressPct: number;
  cacheLeft: string;
  cacheRight: string;
  network: string;
  version: string;
};

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function HandshakeStatus({
  statusText,
  progressPct,
  cacheLeft,
  cacheRight,
  network,
  version,
}: Props) {
  // keep a small visible sliver at 0% like the design
  const fill = Math.max(progressPct, 12);

  return (
    <View>
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <View style={styles.dot} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        <Text style={styles.pct}>{progressPct}%</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fill}%` }]} />
      </View>

      <View style={styles.cacheRow}>
        <Text style={styles.cache}>{cacheLeft}</Text>
        <Text style={styles.cache}>{cacheRight}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.footRow}>
        <View style={styles.netRow}>
          <MaterialCommunityIcons name="access-point-network" size={16} color="#4DA3FF" />
          <Text style={styles.network}>{network}</Text>
        </View>
        <Text style={styles.version}>{version}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: O.amber },
  statusText: { color: "#C9D2EE", fontSize: 12, fontFamily: MONO },
  pct: { color: "#C9D2EE", fontSize: 12, fontFamily: MONO, fontWeight: "700" },
  track: {
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    backgroundColor: O.track,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 2, backgroundColor: "#2F9BFF" },
  cacheRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  cache: { color: O.faint, fontSize: 9.5, fontFamily: MONO, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: O.divider, marginTop: 14 },
  footRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  netRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  network: { color: "#C9D2EE", fontSize: 13 },
  version: { color: O.faint, fontSize: 11, fontFamily: MONO },
});