import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { L } from "../../../theme/loginColors";
import { C } from "../../../theme/loginConflictColors";
import { AvailableUnit, ConflictInfo } from "../types";
import { UnitSelect } from "./UnitSelect";

type Props = {
  conflict: ConflictInfo;
  hub: string;
  units: AvailableUnit[];
  expanded: boolean;
  selectedUnitId: string | null;
  onToggleExpanded: () => void;
  onSelectUnit: (id: string) => void;
  onContactDispatch?: () => void;
};

export function ConflictPanel({
  conflict,
  hub,
  units,
  expanded,
  selectedUnitId,
  onToggleExpanded,
  onSelectUnit,
  onContactDispatch,
}: Props) {
  return (
    <View style={styles.panel} accessibilityRole="alert">
      <View style={styles.head}>
        <View style={styles.alertIcon}>
          <Ionicons name="alert" size={14} color={C.red} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {conflict.vehicle} is already signed in by another driver (started{" "}
            {conflict.startedAt}).
          </Text>
          <Text style={styles.body}>
            Active shift conflict detected with{" "}
            <Text style={styles.bold}>
              {conflict.otherDriverId} ({conflict.otherDriverName})
            </Text>
            . Please verify with dispatch or pick another unit.
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.actions}>
        <Pressable
          onPress={onContactDispatch}
          style={({ pressed }) => [styles.contact, pressed && { opacity: 0.9 }]}
        >
          <MaterialCommunityIcons name="phone-outline" size={16} color={C.redDark} />
          <Text style={styles.contactText}>Contact Dispatch</Text>
        </Pressable>

        <Pressable
          onPress={onToggleExpanded}
          style={({ pressed }) => [styles.change, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.changeText}>Change Vehicle</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#fff" />
        </Pressable>
      </View>

      {expanded ? (
        <View style={styles.units}>
          <Text style={styles.unitsLabel}>AVAILABLE UNITS AT {hub.toUpperCase()}</Text>
          <UnitSelect units={units} selectedId={selectedUnitId} onSelect={onSelectUnit} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: C.redBg,
    borderWidth: 1.5,
    borderColor: C.redBorder,
  },
  head: { flexDirection: "row", gap: 10 },
  alertIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  title: { fontSize: 14, fontWeight: "800", lineHeight: 19, color: C.redText },
  body: { fontSize: 12, lineHeight: 17, color: C.redText, marginTop: 4 },
  bold: { fontWeight: "800" },
  divider: { height: 1, backgroundColor: C.redDivider, marginTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  contact: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.redBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  contactText: { fontSize: 14, fontWeight: "800", color: C.redDark },
  change: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: C.red,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  changeText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  units: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.redDivider,
  },
  unitsLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: L.label,
    marginBottom: 8,
  },
});