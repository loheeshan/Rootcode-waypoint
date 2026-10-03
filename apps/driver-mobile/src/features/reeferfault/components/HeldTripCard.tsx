import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Z } from "../../../theme/reeferColors";
import { TripStatsRow } from "../../today/components/TripStatsRow";
import { HeldTripData } from "../types";

type Props = { trip: HeldTripData; onReportIssue?: () => void };

export function HeldTripCard({ trip, onReportIssue }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={styles.redDot} />
          <Text style={styles.headTitle}>{trip.label}</Text>
        </View>

        <View style={styles.heldPill}>
          <Text style={styles.heldText}>{trip.statusLabel}</Text>
          <View style={styles.heldBang}>
            <Text style={styles.heldBangText}>!</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.sectorRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>SECTOR DESTINATION</Text>
            <View style={styles.valueRow}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={20}
                color={Z.destination}
              />
              <Text style={styles.dest}>{trip.sector}</Text>
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.kicker}>{trip.departureLabel}</Text>
            <View style={styles.valueRow}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={Z.clock} />
              <Text style={styles.time}>{trip.departure}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <TripStatsRow stops={trip.stops} weightKg={trip.weightKg} volume={trip.volume} />
        </View>

        <View style={styles.divider} />

        <View style={styles.loadedRow}>
          <View style={styles.loadedBy}>
            <Ionicons name="checkmark" size={14} color={Z.green} />
            <Text style={styles.loadedByText}>
              Loaded by: <Text style={styles.loadedByBold}>{trip.loadedBy}</Text>
            </Text>
          </View>
          <Text style={styles.seal}>Seal {trip.seal}</Text>
        </View>

        <Pressable
          onPress={onReportIssue}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>Report Vehicle Issue</Text>
          <MaterialCommunityIcons name="alert" size={20} color="#FFD54A" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Z.card,
    borderWidth: 2,
    borderColor: Z.heldBorder,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Z.headerBg,
  },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#F0525A" },
  headTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  heldPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Z.heldPill,
  },
  heldText: { fontSize: 12, fontWeight: "800", color: Z.heldPillText },
  heldBang: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Z.heldPillText,
    alignItems: "center",
    justifyContent: "center",
  },
  heldBangText: { fontSize: 9, fontWeight: "900", color: Z.heldPill, lineHeight: 11 },

  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  sectorRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  kicker: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, color: "#6B7390" },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dest: { fontSize: 18, fontWeight: "800", color: Z.text },
  time: { fontSize: 18, fontWeight: "800", color: Z.text },

  divider: { height: 1, backgroundColor: Z.border, marginTop: 14 },
  loadedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  loadedBy: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  loadedByText: { fontSize: 12, color: "#5B6485" },
  loadedByBold: { fontWeight: "800", color: Z.text },
  seal: { fontSize: 12, color: Z.muted },

  cta: {
    marginTop: 14,
    height: 54,
    borderRadius: 12,
    backgroundColor: Z.alertRed,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});