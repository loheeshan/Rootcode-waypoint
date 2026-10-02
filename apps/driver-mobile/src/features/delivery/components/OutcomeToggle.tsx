import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { D } from "../../../theme/deliveryColor";
import { DeliveryOutcome } from "../types";

type Props = {
  value: DeliveryOutcome;
  onChange: (v: DeliveryOutcome) => void;
  onCantDeliver?: () => void;
};

type OptionProps = {
  label: string;
  selected: boolean;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconColor: string;
  onPress: () => void;
};

function Option({ label, selected, icon, iconColor, onPress }: OptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.option, selected && styles.optionOn]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={selected ? iconColor : D.muted}
      />
      <Text style={[styles.optionText, selected && styles.optionTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function OutcomeToggle({ value, onChange, onCantDeliver }: Props) {
  return (
    <View>
      <View style={styles.headRow}>
        <Text style={styles.label}>DELIVERY OUTCOME</Text>
        <Pressable onPress={onCantDeliver} hitSlop={8}>
          <Text style={styles.cant}>Can't deliver? Tap here → R5</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Option
          label="Delivered"
          selected={value === "delivered"}
          icon="check-circle"
          iconColor="#2ED47A"
          onPress={() => onChange("delivered")}
        />
        <Option
          label="Partially Delivered"
          selected={value === "partial"}
          icon="package-variant-remove"
          iconColor={D.amber}
          onPress={() => onChange("partial")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, color: "#6B7390" },
  cant: { fontSize: 12, fontWeight: "700", color: D.danger },
  row: { flexDirection: "row", gap: 12 },
  option: {
    flex: 1,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: D.card,
    borderWidth: 2,
    borderColor: D.border,
  },
  optionOn: { backgroundColor: D.selectedBg, borderColor: D.primary },
  optionText: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#5B6485",
  },
  optionTextOn: { color: "#fff" },
});