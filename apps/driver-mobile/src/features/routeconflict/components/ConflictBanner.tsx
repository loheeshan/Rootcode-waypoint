import { View, Text, StyleSheet } from "react-native";
import { K } from "../../../theme/conflictColors";

type Props = { title: string; body: string };

export function ConflictBanner({ title, body }: Props) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: K.bannerBg,
  },
  title: { fontSize: 15, fontWeight: "800", color: K.bannerTitle },
  body: { fontSize: 14, lineHeight: 21, color: K.bannerText, marginTop: 6 },
});