import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { L } from "../../../theme/loginColors";

export function LoginHeader() {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[L.navy, L.navyDark]}
      style={[styles.wrap, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.pillText}>SYSTEM ONLINE · COLOMBO HUB</Text>
      </View>

      <View style={styles.brandRow}>
        <View style={styles.logoBox}>
          <MaterialCommunityIcons name="truck" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Waypoint</Text>
          <Text style={styles.brandSub}>DRIVER OS · COMMERCIAL FLEET</Text>
        </View>
        <View style={styles.wifi}>
          <MaterialCommunityIcons name="wifi" size={20} color="#9FB0E8" />
        </View>
      </View>

      <Text style={styles.title}>Driver Shift Sign-In</Text>
      <Text style={styles.subtitle}>
        Authenticate to download today's route manifest and offline sync cache.
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 24 },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2ED47A" },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: L.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontSize: 22, fontWeight: "800" },
  brandSub: { color: "#9FB0E8", fontSize: 10, fontWeight: "600", letterSpacing: 0.8 },
  wifi: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 28 },
  subtitle: { color: "#A9B4DA", fontSize: 14, lineHeight: 20, marginTop: 6 },
});