import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { N } from "../../../theme/nextStopColors";

type Props = { tripRef: string; syncLabel: string };

export function NextStopHeader({ tripRef, syncLabel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={styles.avatar}>
        {/* TODO: replace with the driver's profile photo */}
        <Ionicons name="person" size={22} color="#9FB0E8" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>Waypoint</Text>
        <Text style={styles.sub}>Route</Text>
        <Text style={styles.sub}>{tripRef}</Text>
      </View>

      <View style={styles.sync}>
        <View style={styles.syncDot} />
        <Text style={styles.syncText}>{syncLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: N.navy,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sub: { color: "#A9B4DA", fontSize: 12, fontWeight: "600", lineHeight: 15 },
  sync: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E3F7EA",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: N.green },
  syncText: { fontSize: 12, fontWeight: "700", color: N.green },
});