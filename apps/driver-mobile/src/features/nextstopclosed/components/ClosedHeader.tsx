import { View, Text, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "../../../theme/closedColors";

type Props = { initials: string; tripRef: string; syncLabel: string };

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function ClosedHeader({ initials, tripRef, syncLabel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>Waypoint</Text>
        <Text style={styles.route}>Route {tripRef}</Text>
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
    paddingBottom: 16,
    backgroundColor: X.headerBg,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#2A3566",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#fff", fontSize: 15, fontWeight: "700" },
  brand: { color: "#fff", fontSize: 18, fontWeight: "800" },
  route: { color: "#A9B4DA", fontSize: 12, fontFamily: MONO, marginTop: 2 },
  sync: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2ED47A" },
  syncText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});