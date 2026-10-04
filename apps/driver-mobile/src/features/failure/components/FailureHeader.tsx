import { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { F } from "../../../theme/failureColors";

type Props = {
  vehicle: string;
  syncLabel: string;
  onBack?: () => void;
  children?: ReactNode;
};

export function FailureHeader({ vehicle, syncLabel, onBack, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
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

        <View style={styles.sync}>
          <View style={styles.syncDot} />
          <Text style={styles.syncText}>{syncLabel}</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.redDot} />
        <Text style={styles.title}>Could Not Deliver</Text>
        <View style={styles.vehicle}>
          <Text style={styles.vehicleText}>{vehicle}</Text>
        </View>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: F.navy,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sub: { color: "#A9B4DA", fontSize: 11, fontWeight: "600", letterSpacing: 0.6 },
  sync: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E3F7EA",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: F.green },
  syncText: { fontSize: 12, fontWeight: "700", color: F.green },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: F.danger },
  title: { flex: 1, color: "#fff", fontSize: 22, fontWeight: "800" },
  vehicle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  vehicleText: { color: "#D5DBF2", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
});