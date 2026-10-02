import { ComponentProps } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { N } from "../../../theme/nextStopColors";
import { Maneuver, TurnInstruction } from "../types";
import { MapPreview } from "./MapPreview";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const MANEUVER_ICON: Record<Maneuver, IconName> = {
  right: "turn-right",
  left: "turn-left",
  straight: "arrow-up",
};

type Props = {
  trafficLabel: string;
  instruction: TurnInstruction;
  mapMeta: string;
  gpsLabel: string;
  kmLeft: number;
  onNavigate?: () => void;
};

export function TurnByTurnCard({
  trafficLabel,
  instruction,
  mapMeta,
  gpsLabel,
  kmLeft,
  onNavigate,
}: Props) {
  const verb = instruction.maneuver === "straight" ? "Continue" : `Turn ${instruction.maneuver}`;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <MaterialCommunityIcons name="navigation-variant-outline" size={18} color={N.primary} />
          <Text style={styles.headTitle}>Turn-by-Turn Preview</Text>
        </View>
        <View style={styles.traffic}>
          <Text style={styles.trafficText}>{trafficLabel}</Text>
        </View>
      </View>

      <View style={styles.turnBox}>
        <View style={styles.turnIcon}>
          <MaterialCommunityIcons
            name={MANEUVER_ICON[instruction.maneuver]}
            size={26}
            color="#fff"
          />
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

      <Pressable
        onPress={onNavigate}
        style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.9 }]}
      >
        <MaterialCommunityIcons name="directions" size={20} color={N.primary} />
        <Text style={styles.navText}>Navigate (Turn-by-turn)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: N.card,
    borderWidth: 1,
    borderColor: N.border,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headTitle: { fontSize: 14, fontWeight: "800", color: N.text },
  traffic: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: N.trafficBg,
  },
  trafficText: { fontSize: 12, fontWeight: "800", color: N.green },
  turnBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: N.turnBg,
    borderWidth: 1,
    borderColor: N.turnBorder,
  },
  turnIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: N.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  turnTitle: { fontSize: 19, fontWeight: "800", color: N.text },
  turnSub: { fontSize: 13, color: N.muted, marginTop: 2 },
  navBtn: {
    marginTop: 12,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#CBD5F5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navText: { fontSize: 16, fontWeight: "800", color: N.navy },
});