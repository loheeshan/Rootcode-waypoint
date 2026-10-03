import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { X } from "../../../theme/closedColors";
import { TurnInstruction } from "../../nextstop/types";
import { MapPreview } from "../../nextstop/components/MapPreview";

type Props = {
  trafficLabel: string;
  instruction: TurnInstruction;
  mapMeta: string;
  gpsLabel: string;
  kmLeft: number;
};

export function TurnPreviewCard({
  trafficLabel,
  instruction,
  mapMeta,
  gpsLabel,
  kmLeft,
}: Props) {
  const verb = instruction.maneuver === "straight" ? "Continue" : `Turn ${instruction.maneuver}`;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <MaterialCommunityIcons name="trending-up" size={18} color={X.primary} />
          <Text style={styles.headTitle}>Turn-by-Turn Preview</Text>
        </View>
        <View style={styles.traffic}>
          <Text style={styles.trafficText}>{trafficLabel}</Text>
        </View>
      </View>

      <View style={styles.turnBox}>
        <View style={styles.turnIcon}>
          <MaterialCommunityIcons name="chevron-right" size={28} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.turnTitle}>
            {verb} in {instruction.distance}
          </Text>
          <Text style={styles.turnSub} numberOfLines={1}>
            onto {instruction.street}
            {instruction.hint ? ` (${instruction.hint})` : ""}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <MapPreview meta={mapMeta} gpsLabel={gpsLabel} kmLeft={kmLeft} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: X.card,
    borderWidth: 1,
    borderColor: X.border,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headTitle: { fontSize: 14, fontWeight: "800", color: X.text },
  traffic: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: X.trafficBg,
    borderWidth: 1,
    borderColor: "#BFE8CD",
  },
  trafficText: { fontSize: 12, fontWeight: "800", color: X.green },
  turnBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: X.rowBg,
    borderWidth: 1,
    borderColor: X.border,
  },
  turnIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: X.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  turnTitle: { fontSize: 15, fontWeight: "800", color: X.text },
  turnSub: { fontSize: 12, color: X.muted, marginTop: 3 },
});