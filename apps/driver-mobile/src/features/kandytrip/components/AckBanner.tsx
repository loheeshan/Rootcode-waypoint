import { View, Text, StyleSheet } from "react-native";
import { Y } from "../../../theme/readyColors";

type Props = { title: string; body: string };

export function AckBanner({ title, body }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#EAF0FD",
  },
  title: { fontSize: 15, fontWeight: "800", color: Y.primary },
  body: { fontSize: 14, lineHeight: 21, color: Y.text, marginTop: 6 },
});