import { View, Text, StyleSheet } from "react-native";
import { S } from "../theme/syncColors";

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>Screen coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: S.bg },
  title: { fontSize: 22, fontWeight: "800", color: S.text },
  sub: { marginTop: 4, color: S.muted },
});