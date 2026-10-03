import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { F } from "../../../theme/failureColors";
import { OfflineFailureSnapshot } from "../types";

type Props = {
  data: OfflineFailureSnapshot;
  onBack?: () => void;
  onOpenStop?: () => void;
};

export function OfflineHeader({ data, onBack, onOpenStop }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View>
      {/* amber offline banner, sits behind the status bar */}
      <View style={[styles.banner, { paddingTop: insets.top + 6 }]}>
        <MaterialCommunityIcons name="cloud-off-outline" size={18} color="#fff" />
        <Text style={styles.bannerText}>{data.bannerText}</Text>
        <View style={styles.queued}>
          <Text style={styles.queuedText}>{data.queuedLabel}</Text>
        </View>
      </View>

      <View style={styles.wrap}>
        <View style={styles.top}>
          <Pressable
            onPress={onBack}
            style={styles.back}
            hitSlop={8}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Waypoint</Text>
            <Text style={styles.sub}>DRIVER LOGISTICS</Text>
          </View>

          <View style={styles.pill}>
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>{data.offlineLabel}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <View style={styles.redDot} />
          <Text style={styles.title}>Could Not Deliver</Text>
          <View style={styles.vehicle}>
            <Text style={styles.vehicleText}>{data.vehicle}</Text>
          </View>
        </View>

        <Pressable onPress={onOpenStop} style={styles.stopCard}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{String(data.stopNo).padStart(2, "0")}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.stopTitleRow}>
              <Text style={styles.stopTitle}>
                Stop {data.stopNo}: {data.outletCode}
              </Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{data.tag}</Text>
              </View>
            </View>
            <Text style={styles.stopSub} numberOfLines={1}>
              {data.outletName} • {data.location}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#C4CCE8" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#F5A524",
  },
  bannerText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "800" },
  queued: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(110,60,0,0.45)",
  },
  queuedText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },

  wrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, backgroundColor: F.navy },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontSize: 20, fontWeight: "800" },
  sub: { color: "#A9B4DA", fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F5C242" },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: F.danger },
  title: { flex: 1, color: "#fff", fontSize: 22, fontWeight: "800" },
  vehicle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  vehicleText: { color: "#D5DBF2", fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },

  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  badge: {
    width: 40,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#F4B7B7",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 17, fontWeight: "800", color: F.dangerText },
  stopTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stopTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(80,120,255,0.3)",
    borderWidth: 1,
    borderColor: "rgba(130,160,255,0.45)",
  },
  tagText: { color: "#C9D6FF", fontSize: 10.5, fontWeight: "700" },
  stopSub: { color: "#C4CCE8", fontSize: 13, marginTop: 3 },
});