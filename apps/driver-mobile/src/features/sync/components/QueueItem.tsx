import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { S } from "../../../theme/syncColors";
import { QueueItemData } from "../types";

export function QueueItem({ item }: { item: QueueItemData }) {
  const partial = item.status === "partial";

  return (
    <View style={styles.card}>
      <View style={[styles.badge, { backgroundColor: partial ? S.partialBg : S.greenBg }]}>
        <Text style={[styles.badgeText, { color: partial ? S.primary : S.green }]}>
          {String(item.stopNo).padStart(2, "0")}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.outlet}>{item.outlet}</Text>
          <View style={[styles.chip, { backgroundColor: partial ? S.amberBg : S.greenBg }]}>
            <Text style={[styles.chipText, { color: partial ? S.amberText : S.green }]}>
              {partial ? item.partialLabel ?? "Partial" : "Delivered"}
            </Text>
          </View>
        </View>
        <View style={styles.savedRow}>
          <Ionicons name="checkmark" size={14} color={S.green} />
          <Text style={styles.saved}>Saved on phone · Stop {item.stopNo}</Text>
        </View>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.time}>{item.time}</Text>
        <Text style={styles.cap}>Local cap</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: S.card,
    borderWidth: 1,
    borderColor: S.border,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 17, fontWeight: "800" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  outlet: { fontSize: 16, fontWeight: "800", color: S.text },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  chipText: { fontSize: 11, fontWeight: "700" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  saved: { fontSize: 13, color: S.muted },
  time: { fontSize: 17, fontWeight: "800", color: S.text },
  cap: { fontSize: 11, fontWeight: "600", color: S.muted, marginTop: 2 },
});