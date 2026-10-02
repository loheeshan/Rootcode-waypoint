import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { R } from "../../../theme/todayColors";
import { TripData } from "../types";
import { TripStatsRow } from "./TripStatsRow";

type Props = { trip: TripData; onViewStops?: (trip: TripData) => void };

export function TripCard({ trip, onViewStops }: Props) {
  const loaded = trip.status === "loaded";

  return (
    <View style={[styles.card, loaded && styles.cardLoaded]}>
      {/* header band */}
      <View style={[styles.head, loaded ? styles.headLoaded : styles.headWaiting]}>
        <View style={styles.headLeft}>
          <View
            style={[styles.dot, { backgroundColor: loaded ? "#2ED47A" : R.amber }]}
          />
          <Text style={[styles.headTitle, { color: loaded ? "#fff" : R.text }]}>
            {trip.label}
          </Text>
        </View>

        {loaded ? (
          <View style={styles.loadedPill}>
            <Text style={styles.loadedText}>Loaded</Text>
            <Ionicons name="checkmark" size={13} color="#fff" />
          </View>
        ) : (
          <View style={styles.waitingPill}>
            <Text style={styles.waitingText}>Waiting for loading</Text>
          </View>
        )}
      </View>

      {/* body */}
      <View style={styles.body}>
        <View style={styles.sectorRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>SECTOR DESTINATION</Text>
            <View style={styles.destRow}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={22}
                color={R.destination}
              />
              <Text style={styles.dest}>{trip.sector}</Text>
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.kicker}>{trip.departureLabel}</Text>
            <View style={styles.destRow}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={R.clock} />
              <Text style={styles.time}>{trip.departure}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <TripStatsRow stops={trip.stops} weightKg={trip.weightKg} volume={trip.volume} />
        </View>

        {loaded ? (
          <>
            <View style={styles.loadedRow}>
              <View style={styles.loadedBy}>
                <MaterialCommunityIcons name="check-decagram" size={18} color={R.green} />
                <Text style={styles.loadedByText}>
                  Loaded by: <Text style={styles.loadedByBold}>{trip.loadedBy}</Text>
                </Text>
              </View>
              <Text style={styles.seal}>Seal {trip.seal}</Text>
            </View>

            <Pressable
              onPress={() => onViewStops?.(trip)}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.ctaText}>View Trip Stops</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: R.card,
    borderWidth: 1,
    borderColor: R.border,
  },
  cardLoaded: { borderWidth: 2, borderColor: "#B7C4F2" },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headLoaded: { backgroundColor: R.cardHeader },
  headWaiting: { backgroundColor: "#fff" },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  headTitle: { fontSize: 18, fontWeight: "800" },
  loadedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: R.loadedBg,
  },
  loadedText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  waitingPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: R.waitingBg,
    borderWidth: 1,
    borderColor: "#F2D98A",
  },
  waitingText: { fontSize: 13, fontWeight: "800", color: R.waitingText },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  sectorRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: "#6B7390" },
  destRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dest: { fontSize: 20, fontWeight: "800", color: R.destination },
  time: { fontSize: 20, fontWeight: "800", color: R.text },
  loadedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  loadedBy: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  loadedByText: { fontSize: 13, color: "#5B6485" },
  loadedByBold: { fontWeight: "800", color: R.text },
  seal: { fontSize: 13, color: R.muted },
  cta: {
    marginTop: 14,
    height: 54,
    borderRadius: 14,
    backgroundColor: R.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});