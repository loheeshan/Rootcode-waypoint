import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { X } from "../../../theme/closedColors";
import { AccessClosedInfo } from "../types";

type Props = {
  access: AccessClosedInfo;
  windowStart: string;
  windowEnd: string;
  onCallReceiver?: () => void;
};

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function AccessClosedCard({ access, windowStart, windowEnd, onCallReceiver }: Props) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.topRow}>
        <View style={styles.warnIcon}>
          <MaterialCommunityIcons name="alert-outline" size={22} color="#fff" />
        </View>

        <View style={styles.pill}>
          <Text style={styles.pillText}>BAY ACCESS CLOSED</Text>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.dock}>
          <Text style={styles.dockText}>Dock: {access.dock}</Text>
        </View>
      </View>

      <Text style={styles.message}>
        Mall loading bay access: CLOSED — window is {windowStart}–{windowEnd}, current time{" "}
        {access.currentTime}.
      </Text>

      <View style={styles.waitBox}>
        <View style={styles.waitHead}>
          <MaterialCommunityIcons name="clock-outline" size={20} color={X.waitTitle} />
          <Text style={styles.waitTitle}>
            Wait {access.waitMinutes} min until gate unlocks ({access.opensAt})
          </Text>
        </View>
        <Text style={styles.waitNote}>{access.waitNote}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.pinRow}>
        <MaterialCommunityIcons name="lock-open-outline" size={18} color={X.primary} />
        <Text style={styles.pinText} numberOfLines={1}>
          {access.gateLabel}: <Text style={styles.pinCode}>{access.pinCode}</Text>
        </Text>
        <Text style={styles.locked}>Locked until {access.opensAt}</Text>
      </View>

      <Pressable
        onPress={onCallReceiver}
        style={({ pressed }) => [styles.call, pressed && { opacity: 0.9 }]}
      >
        <MaterialCommunityIcons name="phone-outline" size={18} color={X.primary} />
        <Text style={styles.callText}>Call Receiver ({access.receiverName})</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: X.warnBg,
    borderWidth: 2,
    borderColor: X.warnBorder,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  warnIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: X.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: X.warnPillBg,
  },
  pillText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4, color: X.warnText },
  dock: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#C9CFE2",
  },
  dockText: { fontSize: 11.5, fontWeight: "700", fontFamily: MONO, color: X.text },
  message: { fontSize: 14, fontWeight: "800", lineHeight: 20, color: X.text, marginTop: 12 },
  waitBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: X.waitBg,
    borderWidth: 1,
    borderColor: X.waitBorder,
  },
  waitHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  waitTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: X.waitTitle },
  waitNote: { fontSize: 12, lineHeight: 17, color: X.waitBody, marginTop: 4 },
  divider: { height: 1, backgroundColor: "#F1DDA0", marginTop: 12 },
  pinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8DDB8",
  },
  pinText: { flex: 1, fontSize: 13, color: "#4A5478" },
  pinCode: { fontWeight: "800", color: X.text },
  locked: { fontSize: 11.5, color: X.muted },
  call: {
    marginTop: 10,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#C9CFE2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  callText: { fontSize: 14, fontWeight: "800", color: X.navy },
});