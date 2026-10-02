import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { D } from "../../../theme/deliveryColor";

type Props = {
  value: number;
  max: number;
  min?: number;
  onChange: (n: number) => void;
};

function StepButton({
  icon,
  disabled,
  onPress,
  label,
}: {
  icon: "add" | "remove";
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[styles.btn, disabled && { opacity: 0.4 }]}
    >
      <Ionicons name={icon} size={18} color={D.text} />
    </Pressable>
  );
}

export function Stepper({ value, max, min = 0, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <StepButton
        icon="remove"
        label="Decrease quantity"
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
      />
      <Text style={styles.value}>{value}</Text>
      <StepButton
        icon="add"
        label="Increase quantity"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 130,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 4,
    borderRadius: 10,
    backgroundColor: D.card,
    borderWidth: 1,
    borderColor: D.border,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: D.stepperBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontSize: 18, fontWeight: "800", color: D.text },
});