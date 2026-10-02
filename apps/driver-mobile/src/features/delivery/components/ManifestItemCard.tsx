import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { D } from "../../../theme/deliveryColor";
import { ExceptionCode, ManifestItemData } from "../types";
import { Stepper } from "./Stepper";
import { ExceptionSelect } from "./ExceptionSelect";

type Props = {
  item: ManifestItemData;
  qty: number;
  exception: ExceptionCode;
  onQtyChange: (n: number) => void;
  onExceptionChange: (c: ExceptionCode) => void;
};

export function ManifestItemCard({
  item,
  qty,
  exception,
  onQtyChange,
  onExceptionChange,
}: Props) {
  const full = qty === item.expected;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <MaterialCommunityIcons name={item.icon} size={22} color={D.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            LOT: {item.lot} · Temp: {item.temp}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: full ? D.okBadge : D.amberBg }]}>
          <Text style={[styles.badgeText, { color: full ? "#fff" : D.amberText }]}>
            {qty}/{item.expected}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <Stepper value={qty} max={item.expected} onChange={onQtyChange} />
        <ExceptionSelect value={exception} onChange={onExceptionChange} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: D.itemBg,
    borderWidth: 1,
    borderColor: D.border,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontSize: 15, fontWeight: "800", color: D.text },
  meta: { fontSize: 12, fontWeight: "600", color: D.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  controls: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
});