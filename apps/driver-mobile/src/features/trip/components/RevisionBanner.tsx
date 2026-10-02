import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { T } from "../../../theme/tripColors";

type Props = { message: string; onDismiss?: () => void };

export function RevisionBanner({ message, onDismiss }: Props) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <MaterialCommunityIcons name="bell-outline" size={20} color={T.amberText} />

      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Route Revision</Text>
        <Text style={styles.message}>{message}</Text>
      </View>

      <Pressable onPress={onDismiss} style={styles.ok} hitSlop={6}>
        <Text style={styles.okText}>OK</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: T.bannerBg,
    borderLeftWidth: 4,
    borderLeftColor: T.amber,
  },
  title: { fontSize: 14, fontWeight: "800", color: T.bannerText },
  message: { fontSize: 14, lineHeight: 19, color: T.bannerText, marginTop: 2 },
  ok: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: T.amber,
  },
  okText: { fontSize: 13, fontWeight: "800", color: "#fff" },
});