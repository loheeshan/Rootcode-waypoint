import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { T } from "../../../theme/tripColors";
import { TripStop } from "../types";
import { StopCard } from "./StopCard";

type Props = { stops: TripStop[]; onStopPress?: (stop: TripStop) => void };

export function StopSequence({ stops, onStopPress }: Props) {
  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>STOP SEQUENCE ({stops.length} STOPS)</Text>
        <View style={styles.auto}>
          <MaterialCommunityIcons name="sort-variant" size={16} color={T.primary} />
          <Text style={styles.autoText}>Auto-Optimized</Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        {stops.map((stop) => (
          <StopCard key={stop.id} stop={stop} onPress={() => onStopPress?.(stop)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: "#6B7390" },
  auto: { flexDirection: "row", alignItems: "center", gap: 4 },
  autoText: { fontSize: 13, fontWeight: "800", color: T.primary },
});