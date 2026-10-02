import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { R } from "../../../theme/todayColors";

export function OfflineReadyBanner() {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="checkmark" size={22} color="#fff" />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>✓ Trips saved on this phone</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>R1 OFFLINE-READY</Text>
          </View>
        </View>
        <Text style={styles.body}>
          Full manifests, offline maps, and receiver barcodes are cached. Safe to depart
          cellular range.
        </Text>
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
    backgroundColor: R.bannerBg,
    borderWidth: 1,
    borderColor: R.bannerBorder,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: R.green,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: "800", lineHeight: 21, color: R.green },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: R.bannerChipBg,
  },
  chipText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4, color: R.green },
  body: { fontSize: 14, lineHeight: 20, color: R.bannerText, marginTop: 4 },
});