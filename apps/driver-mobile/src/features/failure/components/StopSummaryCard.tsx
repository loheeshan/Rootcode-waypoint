import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { F } from "../../../theme/failureColors";

type Props = {
  stopNo: number;
  outletCode: string;
  tag: string;
  outletName: string;
  location: string;
  onPress?: () => void;
};

export function StopSummaryCard({
  stopNo,
  outletCode,
  tag,
  outletName,
  location,
  onPress,
}: Props) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{String(stopNo).padStart(2, "0")}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            Stop {stopNo}: {outletCode}
          </Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {outletName} • {location}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#9FB0E8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: F.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 17, fontWeight: "800", color: F.dangerText },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  tagText: { color: "#C4CCE8", fontSize: 11, fontWeight: "600" },
  sub: { color: "#A9B4DA", fontSize: 13, marginTop: 3 },
});