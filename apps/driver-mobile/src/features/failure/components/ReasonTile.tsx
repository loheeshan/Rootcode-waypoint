import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { F } from "../../../theme/failureColors";
import { ReasonDef } from "../reasons";
import { ReasonRadio } from "./ReasonRadio";

type Props = { reason: ReasonDef; selected: boolean; onPress: () => void };

export function ReasonTile({ reason, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.tile, selected && styles.tileOn]}
    >
      <View style={styles.top}>
        <MaterialCommunityIcons
          name={reason.icon}
          size={20}
          color={selected ? "#fff" : F.muted}
        />
        <ReasonRadio selected={selected} size={20} />
      </View>
      <Text style={[styles.label, selected && styles.labelOn]}>{reason.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 88,
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: F.card,
    borderWidth: 2,
    borderColor: F.border,
  },
  tileOn: { backgroundColor: F.selectedBg, borderColor: F.primary },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 14, fontWeight: "700", lineHeight: 19, color: F.text },
  labelOn: { color: "#fff", fontWeight: "800" },
});