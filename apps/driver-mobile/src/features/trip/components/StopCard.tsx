import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "../../../theme/tripColors";
import { StopStatus, TripStop } from "../types";

type Props = { stop: TripStop; onPress?: () => void };

function StatusCircle({ status, stopNo }: { status: StopStatus; stopNo: number }) {
  if (status === "delivered") {
    return (
      <View style={[styles.circle, { backgroundColor: T.green }]}>
        <Ionicons name="checkmark" size={22} color="#fff" />
      </View>
    );
  }
  if (status === "partial") {
    return (
      <View style={[styles.circle, { backgroundColor: T.amber }]}>
        <Ionicons name="checkmark" size={22} color="#fff" />
      </View>
    );
  }
  if (status === "failed") {
    return (
      <View style={[styles.circle, { backgroundColor: T.danger }]}>
        <Ionicons name="close" size={22} color="#fff" />
      </View>
    );
  }
  if (status === "current") {
    return (
      <View style={[styles.circle, { backgroundColor: T.amber }]}>
        <Text style={styles.circleNum}>{stopNo}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.circle, { backgroundColor: T.upcomingBg }]}>
      <Text style={[styles.circleNum, { color: T.muted }]}>{stopNo}</Text>
    </View>
  );
}

function chipFor(stop: TripStop): { text: string; bg: string; color: string } | null {
  switch (stop.status) {
    case "delivered":
      return { text: `Delivered ${stop.doneAt ?? ""}`.trim(), bg: T.greenBg, color: T.green };
    case "partial":
      return { text: `Partial ${stop.doneAt ?? ""}`.trim(), bg: T.amberBg, color: T.amberText };
    case "failed":
      return { text: `Failed ${stop.doneAt ?? ""}`.trim(), bg: T.dangerBg, color: T.dangerText };
    case "current":
      return { text: "Current stop", bg: T.activeChipBg, color: T.primary };
    default:
      return null;
  }
}

export function StopCard({ stop, onPress }: Props) {
  const chip = chipFor(stop);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <StatusCircle status={stop.status} stopNo={stop.stopNo} />

      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Stop {stop.stopNo}</Text>
          {chip ? (
            <View style={[styles.chip, { backgroundColor: chip.bg }]}>
              <Text style={[styles.chipText, { color: chip.color }]}>{chip.text}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.outlet} numberOfLines={1}>
          {stop.outlet}
        </Text>
        <Text style={styles.window}>
          Window: {stop.windowStart}-{stop.windowEnd}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={T.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  circleNum: { fontSize: 17, fontWeight: "800", color: "#fff" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontWeight: "800", color: T.text },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  chipText: { fontSize: 11, fontWeight: "700" },
  outlet: { fontSize: 15, color: "#4A5478", marginTop: 4 },
  window: { fontSize: 12, color: T.muted, marginTop: 3 },
});