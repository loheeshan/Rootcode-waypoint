import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { F } from "../../../theme/failureColors";

type Props = { onPress?: () => void; disabled?: boolean };

export function FailureSubmitBar({ onPress, disabled = false }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.cta,
          disabled && styles.ctaDisabled,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Ionicons name="alert-circle-outline" size={20} color="#fff" />
        <Text style={styles.ctaText}>Submit Failed Delivery</Text>
      </Pressable>
      <View style={styles.savedRow}>
        <View style={styles.dot} />
        <Text style={styles.saved}>Saved on phone — will sync automatically when online</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: F.card,
    borderTopWidth: 1,
    borderTopColor: F.border,
  },
  cta: {
    height: 54,
    borderRadius: 14,
    backgroundColor: F.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaDisabled: { backgroundColor: "#9AA9E6" },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: F.green },
  saved: { fontSize: 12, fontWeight: "600", color: F.green },
});