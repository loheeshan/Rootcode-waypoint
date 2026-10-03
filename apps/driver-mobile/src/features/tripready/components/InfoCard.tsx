import { View, Text, StyleSheet } from "react-native";
import { Y } from "../../../theme/readyColors";

type Props = {
  title: string;
  lines: string[];
  large?: boolean; // the Departure card has a slightly bigger title
};

export function InfoCard({ title, lines, large = false }: Props) {
  return (
    <View style={styles.card}>
      <Text style={[styles.title, large && styles.titleLarge]}>{title}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: Y.card,
    borderWidth: 1,
    borderColor: Y.border,
  },
  title: { fontSize: 18, fontWeight: "800", color: Y.text },
  titleLarge: { fontSize: 20 },
  line: { fontSize: 14, color: Y.muted, marginTop: 8 },
});