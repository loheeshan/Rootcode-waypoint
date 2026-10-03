import { View, Text, StyleSheet } from "react-native";
import { Y } from "../../../theme/readyColors";

type Props = {
  tripLabel: string;
  sector: string;
  stopCount: number;
  loadedBy: string;
  seal: string;
};

export function DownloadedBanner({ tripLabel, sector, stopCount, loadedBy, seal }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Trip downloaded to this phone</Text>
      <Text style={styles.body}>
        {tripLabel} · {sector} · {stopCount} stops. Loaded by {loadedBy}; seal {seal} verified.
      </Text>
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