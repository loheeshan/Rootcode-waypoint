import { View, Text, StyleSheet } from "react-native";
import { D } from "../../../theme/deliveryColor";
import { ExceptionCode, ManifestItemData } from "../types";
import { ManifestItemCard } from "./ManifestItemCard";

type Props = {
  items: ManifestItemData[];
  quantities: Record<string, number>;
  exceptions: Record<string, ExceptionCode>;
  onQtyChange: (id: string, n: number) => void;
  onExceptionChange: (id: string, c: ExceptionCode) => void;
};

export function ManifestChecklist({
  items,
  quantities,
  exceptions,
  onQtyChange,
  onExceptionChange,
}: Props) {
  const total = items.reduce((sum, i) => sum + i.expected, 0);
  const verified = items.reduce((sum, i) => sum + (quantities[i.id] ?? 0), 0);
  const complete = verified === total;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Manifest Checklist</Text>
          <Text style={styles.sub}>
            {complete
              ? `All ${total} Cartons Verified In-Chamber`
              : `${verified} of ${total} Cartons Verified`}
          </Text>
        </View>
        <View
          style={[styles.count, { backgroundColor: complete ? D.greenBg : D.amberBg }]}
        >
          <Text style={[styles.countText, { color: complete ? D.green : D.amberText }]}>
            {verified}/{total}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={{ gap: 12 }}>
        {items.map((item) => (
          <ManifestItemCard
            key={item.id}
            item={item}
            qty={quantities[item.id] ?? 0}
            exception={exceptions[item.id] ?? "none"}
            onQtyChange={(n) => onQtyChange(item.id, n)}
            onExceptionChange={(c) => onExceptionChange(item.id, c)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: D.card,
    borderWidth: 1,
    borderColor: D.border,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: D.text },
  sub: { fontSize: 12, fontWeight: "700", color: "#5B6485", marginTop: 2 },
  count: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  countText: { fontSize: 13, fontWeight: "800" },
  divider: { height: 1, backgroundColor: D.border, marginVertical: 12 },
});