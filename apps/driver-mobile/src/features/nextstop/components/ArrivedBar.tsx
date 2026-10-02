import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { N } from "../../../theme/nextStopColors";

type Props = { onPress?: () => void };

export function ArrivedBar({ onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
      >
        <MaterialCommunityIcons name="map-marker-outline" size={22} color="#fff" />
        <Text style={styles.ctaText}>ARRIVED AT OUTLET</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "rgba(243,245,252,0.97)",
    borderTopWidth: 1,
    borderTopColor: N.border,
  },
  cta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: N.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.8 },
});