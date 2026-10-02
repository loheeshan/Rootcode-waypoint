import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { F } from "../../../theme/failureColors";

type Props = { selected: boolean; size?: number };

export function ReasonRadio({ selected, size = 26 }: Props) {
  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        selected && styles.ringOn,
      ]}
    >
      {selected ? <Ionicons name="checkmark" size={size * 0.6} color="#fff" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    borderColor: F.radioBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  ringOn: { backgroundColor: F.primary, borderColor: F.primary },
});