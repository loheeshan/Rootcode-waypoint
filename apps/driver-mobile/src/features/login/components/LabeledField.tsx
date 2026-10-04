import { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { L } from "../../../theme/loginColors";

type Props = {
  label: string;
  rightLabel?: string;
  onRightPress?: () => void;
  children: ReactNode;
};

/** Small uppercase label with an optional link on the right, above a white card. */
export function LabeledField({ label, rightLabel, onRightPress, children }: Props) {
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        {rightLabel ? (
          <Pressable onPress={onRightPress} hitSlop={8}>
            <Text style={styles.link}>{rightLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 18 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, color: L.label },
  link: { fontSize: 11, fontWeight: "700", color: L.primary },
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
});