import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { V } from "../../../theme/revisionColors";
import { RevisionStop } from "../types";

type Props = { stop: RevisionStop; onPress?: () => void };

function Circle({ stop }: { stop: RevisionStop }) {
  if (stop.status === "delivered") {
    return (
      <View style={[styles.circle, { backgroundColor: V.green }]}>
        <Ionicons name="checkmark" size={20} color="#fff" />
      </View>
    );
  }
  if (stop.status === "partial") {
    return (
      <View style={[styles.circle, { backgroundColor: V.partialCircle }]}>
        <Ionicons name="checkmark" size={20} color="#fff" />
      </View>
    );
  }
  return (
    <View style={[styles.circle, { backgroundColor: V.upcomingCircle }]}>
      <Text style={styles.num}>{stop.stopNo}</Text>
    </View>
  );
}

export function StopRow({ stop, onPress }: Props) {
  const delivered = stop.status === "delivered";
  const partial = stop.status === "partial";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <Circle stop={stop} />

      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Stop {stop.stopNo}</Text>
          {delivered || partial ? (
            <View
              style={[
                styles.chip,
                delivered ? styles.chipDelivered : styles.chipPartial,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: delivered ? V.green : "#B77700" },
                ]}
              >
                {delivered ? "Delivered" : "Partial"} {stop.doneAt}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.outlet} numberOfLines={1}>
          {stop.outlet}
        </Text>
        <Text style={styles.window}>
          Window: {stop.windowStart}–{stop.windowEnd}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={V.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: V.card,
    borderWidth: 1,
    borderColor: V.border,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  num: { fontSize: 16, fontWeight: "800", color: V.muted },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontWeight: "800", color: V.text },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  chipDelivered: { backgroundColor: V.deliveredBg, borderColor: V.deliveredBorder },
  chipPartial: { backgroundColor: V.partialBg, borderColor: V.partialBorder },
  chipText: { fontSize: 10.5, fontWeight: "700" },
  outlet: { fontSize: 13, color: "#4A5478", marginTop: 4 },
  window: { fontSize: 10.5, color: V.muted, marginTop: 3 },
});