import { View, StyleSheet } from "react-native";
import { ReasonDef } from "../reasons";
import { FailureReasonCode } from "../types";
import { ReasonOption } from "./ReasonOption";
import { ReasonTile } from "./ReasonTile";

type Props = {
  reasons: ReasonDef[];
  value: FailureReasonCode | null;
  onChange: (code: FailureReasonCode) => void;
};

export function ReasonPicker({ reasons, value, onChange }: Props) {
  const wide = reasons.filter((r) => r.size === "wide");
  const compact = reasons.filter((r) => r.size === "compact");

  return (
    <View style={{ gap: 12 }} accessibilityRole="radiogroup">
      {wide.map((r) => (
        <ReasonOption
          key={r.code}
          reason={r}
          selected={value === r.code}
          onPress={() => onChange(r.code)}
        />
      ))}

      <View style={styles.grid}>
        {compact.map((r) => (
          <View key={r.code} style={styles.cell}>
            <ReasonTile
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  cell: { width: "48%" },
});