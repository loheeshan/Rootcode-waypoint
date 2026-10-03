import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { V } from "../../../theme/revisionColors";
import { RevisionStop } from "../types";

type Props = { stop: RevisionStop; onPress?: () => void };

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const pad = (n: number) => String(n).padStart(2, "0");

export function NextStopCard({ stop, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.95 }}>
      <LinearGradient colors={[V.nextBg, V.nextBgEnd]} style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.chips}>
            <View style={styles.nextChip}>
              <Text style={styles.nextChipText}>NEXT STOP</Text>
            </View>
            {stop.outletCode ? (
              <View style={styles.codeChip}>
                <Text style={styles.codeText}>{stop.outletCode}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.etaLabel}>PLANNED ETA</Text>
            <Text style={styles.eta}>{stop.eta}</Text>
          </View>
        </View>

        <Text style={styles.title}>
          {pad(stop.stopNo)} {stop.outlet}
        </Text>

        {stop.address ? (
          <View style={styles.row}>
            <MaterialCommunityIcons name="map-marker-outline" size={16} color="#8FA2E8" />
            <Text style={styles.rowText} numberOfLines={1}>
              {stop.address}
            </Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <MaterialCommunityIcons name="clock-outline" size={16} color={V.amber} />
          <Text style={styles.rowText}>
            Window {stop.windowStart}–{stop.windowEnd}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 20 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  chips: { flexDirection: "row", alignItems: "center", gap: 8 },
  nextChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: V.primary,
  },
  nextChipText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  codeChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  codeText: { color: "#D5DBF2", fontSize: 11, fontFamily: MONO, fontWeight: "700" },
  etaLabel: { color: "#8FA2E8", fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  eta: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  rowText: { flex: 1, color: "#C4CCE8", fontSize: 13 },
});