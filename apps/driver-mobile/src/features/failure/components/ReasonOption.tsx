import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { F } from "../../../theme/failureColors";
import { ReasonDef } from "../reasons";
import { ReasonRadio } from "./ReasonRadio";

type Props = { reason: ReasonDef; selected: boolean; onPress: () => void };

export function ReasonOption({ reason, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.card, selected && styles.cardOn]}
    >
      <View style={[styles.iconBox, selected && styles.iconBoxOn]}>
        <MaterialCommunityIcons
          name={reason.icon}
          size={20}
          color={selected ? "#fff" : F.muted}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.label, selected && styles.labelOn]}>{reason.label}</Text>
        {selected ? <Text style={styles.selectedText}>Selected Reason</Text> : null}
      </View>

      <ReasonRadio selected={selected} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: F.card,
    borderWidth: 2,
    borderColor: F.border,
  },
  cardOn: { backgroundColor: F.selectedBg, borderColor: F.primary },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: F.tileIconBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxOn: { backgroundColor: "rgba(255,255,255,0.14)" },
  label: { fontSize: 16, fontWeight: "700", color: F.text },
  labelOn: { color: "#fff", fontWeight: "800" },
  selectedText: { marginTop: 3, fontSize: 12, fontWeight: "600", color: "#9FB0E8" },
});