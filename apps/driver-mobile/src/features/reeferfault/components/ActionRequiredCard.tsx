import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Z } from "../../../theme/reeferColors";

type Props = { chip: string; message: string };

export function ActionRequiredCard({ chip, message }: Props) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.icon}>
        <MaterialCommunityIcons name="alert" size={18} color="#fff" />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{chip}</Text>
        </View>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Z.alertBg,
    borderWidth: 2,
    borderColor: Z.alertBorder,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Z.alertRed,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: Z.alertChipBg,
    borderWidth: 1,
    borderColor: Z.alertChipBorder,
  },
  chipText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, color: Z.alertText },
  message: { fontSize: 14, fontWeight: "800", lineHeight: 19, color: Z.alertText, marginTop: 6 },
});