import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { O } from "../../../theme/offlineLaunchColors";

type Props = {
  title: string;
  body: string;
  footnote: string;
  retrying?: boolean;
  onRetry?: () => void;
};

export function ConnectionCard({ title, body, footnote, retrying = false, onRetry }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.iconRing}>
        <MaterialCommunityIcons name="wifi-off" size={24} color={O.amber} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      <Pressable
        onPress={onRetry}
        disabled={retrying}
        style={({ pressed }) => [styles.btnWrap, pressed && { opacity: 0.9 }]}
      >
        <LinearGradient
          colors={[O.blue, O.indigo]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.btn}
        >
          <MaterialCommunityIcons name="sync" size={18} color="#fff" />
          <Text style={styles.btnText}>{retrying ? "Retrying…" : "Retry Connection"}</Text>
        </LinearGradient>
      </Pressable>

      <View style={styles.noteRow}>
        <MaterialCommunityIcons name="check-circle-outline" size={15} color={O.green} />
        <Text style={styles.note}>{footnote}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderRadius: 22,
    backgroundColor: O.cardBg,
    borderWidth: 1,
    borderColor: O.cardBorder,
  },
  iconRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(245,165,36,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(245,165,36,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: O.white, fontSize: 18, fontWeight: "800", marginTop: 14 },
  body: {
    color: O.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  btnWrap: {
    alignSelf: "stretch",
    marginTop: 18,
    borderRadius: 14,
    shadowColor: O.blue,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  note: { color: O.muted, fontSize: 12 },
});