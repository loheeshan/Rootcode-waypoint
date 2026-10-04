import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { L } from "../../../theme/loginColors";

type Props = {
  plate: string;
  depot: string;
  chamber: string;
  capacity: string;
};

export function VehicleCard({ plate, depot, chamber, capacity }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name="snowflake" size={22} color={L.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {plate} <Text style={styles.depot}>· {depot}</Text>
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.chamber}>
            <Text style={styles.chamberText}>{chamber}</Text>
          </View>
          <Text style={styles.capacity}>{capacity}</Text>
        </View>
      </View>

      <MaterialCommunityIcons name="swap-horizontal" size={20} color={L.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: L.infoBg,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: L.text },
  depot: { fontSize: 14, fontWeight: "400", color: L.muted },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  chamber: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: L.chamberBg,
  },
  chamberText: { fontSize: 11, fontWeight: "700", color: L.chamberText },
  capacity: { fontSize: 12, color: L.muted },
});