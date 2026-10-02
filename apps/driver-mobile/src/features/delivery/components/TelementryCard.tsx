import { View, Text, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { D } from "../../../theme/deliveryColor";

type Props = { arrival: string; completion: string; dwell: string };

export function TelemetryCard({ arrival, completion, dwell }: Props) {
  return (
    <View style={styles.card}>
      <Ionicons name="time-outline" size={22} color={D.green} />
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>CAPTURED PHONE TELEMETRY</Text>
        <Text style={styles.line}>
          Arrival {arrival} · completion {completion}
        </Text>
      </View>
      <View style={styles.dwell}>
        <MaterialCommunityIcons name="check-decagram" size={14} color={D.green} />
        <Text style={styles.dwellText}>{dwell}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: D.card,
    borderWidth: 1,
    borderColor: D.border,
  },
  kicker: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: D.muted },
  line: { fontSize: 14, fontWeight: "800", color: D.text, marginTop: 2 },
  dwell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: D.greenBg,
  },
  dwellText: { fontSize: 12, fontWeight: "700", color: D.green },
});