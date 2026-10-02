import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { S } from "../../../theme/syncColors";

export function InfoNote({ lastHeard }: { lastHeard: string }) {
  return (
    <View style={styles.box}>
      <Ionicons name="information-circle-outline" size={20} color={S.muted} />
      <Text style={styles.text}>
        <Text style={styles.bold}>Dispatcher sees: </Text>
        Last heard {lastHeard} · Local phone timestamps will sync automatically.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: S.infoBg,
    borderWidth: 1,
    borderColor: S.border,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 19, color: "#4A5478" },
  bold: { fontWeight: "800", color: S.text },
});