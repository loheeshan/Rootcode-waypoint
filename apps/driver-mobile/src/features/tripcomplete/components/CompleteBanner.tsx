import { View, Text, StyleSheet } from "react-native";
import { Y } from "../../../theme/readyColors";

type Props = { title: string; body: string };

export function CompleteBanner({ title, body }: Props) {
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
    backgroundColor: Y.bannerBg,
  },
  title: { fontSize: 15, fontWeight: "800", color: Y.bannerTitle },
  body: { fontSize: 14, lineHeight: 20, color: Y.bannerText, marginTop: 6 },
});