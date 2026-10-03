import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { F } from "../../../theme/failureColors";
import { REASONS, ReasonDef } from "../../failure/reasons";
import { FailureReasonCode } from "../../failure/types";
import { REASON_ICONS } from "../reasonIcons";

const BLUE = "#3B82F6";

type Props = {
  value: FailureReasonCode | null;
  onChange: (code: FailureReasonCode) => void;
};

function Radio({ selected, size }: { selected: boolean; size: number }) {
  return (
    <View
      style={[
        styles.radio,
        { width: size, height: size, borderRadius: size / 2 },
        selected && styles.radioOn,
      ]}
    >
      {selected ? <Ionicons name="checkmark" size={size * 0.62} color="#fff" /> : null}
    </View>
  );
}

function Row({
  reason,
  selected,
  onPress,
}: {
  reason: ReasonDef;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.row, selected && styles.rowOn]}
    >
      <View style={[styles.iconBox, selected && styles.iconBoxOn]}>
        <MaterialCommunityIcons
          name={REASON_ICONS[reason.code]}
          size={18}
          color={selected ? "#fff" : F.muted}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, selected && styles.labelOn]}>{reason.label}</Text>
        {selected ? <Text style={styles.selectedText}>Selected Reason</Text> : null}
      </View>

      <Radio selected={selected} size={24} />
    </Pressable>
  );
}

function Tile({
  reason,
  selected,
  onPress,
}: {
  reason: ReasonDef;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.tile, selected && styles.rowOn]}
    >
      <View style={styles.tileTop}>
        <MaterialCommunityIcons
          name={REASON_ICONS[reason.code]}
          size={18}
          color={selected ? "#fff" : F.muted}
        />
        <Radio selected={selected} size={20} />
      </View>
      <Text style={[styles.tileLabel, selected && styles.labelOn]}>{reason.label}</Text>
    </Pressable>
  );
}

export function ReasonList({ value, onChange }: Props) {
  const wide = REASONS.filter((r) => r.size === "wide");
  const compact = REASONS.filter((r) => r.size === "compact");

  return (
    <View style={{ gap: 10 }} accessibilityRole="radiogroup">
      {wide.map((r) => (
        <Row
          key={r.code}
          reason={r}
          selected={value === r.code}
          onPress={() => onChange(r.code)}
        />
      ))}

      <View style={styles.grid}>
        {compact.map((r) => (
          <View key={r.code} style={styles.cell}>
            <Tile
              reason={r}
              selected={value === r.code}
              onPress={() => onChange(r.code)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: F.card,
    borderWidth: 1.5,
    borderColor: F.border,
  },
  rowOn: { backgroundColor: F.selectedBg, borderColor: BLUE },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: F.tileIconBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxOn: { backgroundColor: "rgba(255,255,255,0.14)" },
  rowLabel: { fontSize: 14, fontWeight: "700", color: F.text },
  labelOn: { color: "#fff" },
  selectedText: { marginTop: 2, fontSize: 11, fontWeight: "600", color: "#9FB0E8" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  cell: { width: "48.5%" },
  tile: {
    minHeight: 70,
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: F.card,
    borderWidth: 1.5,
    borderColor: F.border,
  },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tileLabel: { fontSize: 13, fontWeight: "700", lineHeight: 17, color: F.text },

  radio: {
    borderWidth: 1.5,
    borderColor: "#C9CFE2",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { backgroundColor: BLUE, borderColor: BLUE },
});
