import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { V } from "../../theme/revisionColors";
import { RevisionStop, TripRevisionSnapshot } from "./types";
import { RevisionBanner } from "../trip/components/RevisionBanner";
import { RevisionHeader } from "./components/RevisionHeader";
import { SummaryCard } from "./components/SummaryCard";
import { StopRow } from "./components/StopRow";
import { NextStopCard } from "./components/NextStopCard";

type Props = {
  data: TripRevisionSnapshot;
  onContinue?: () => void;
  onStopPress?: (stop: RevisionStop) => void;
};

const DONE: RevisionStop["status"][] = ["delivered", "partial"];

export function TripRevisionScreen({ data, onContinue, onStopPress }: Props) {
  const [showBanner, setShowBanner] = useState(data.revisionMessage !== null);
  const completed = data.stops.filter((s) => DONE.includes(s.status)).length;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <RevisionHeader
        driverName={data.driverName}
        vehicle={data.vehicle}
        syncLabel={data.syncLabel}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {showBanner && data.revisionMessage ? (
          <RevisionBanner
            message={data.revisionMessage}
            onDismiss={() => setShowBanner(false)}
          />
        ) : null}

        <SummaryCard
          tripLabel={data.tripLabel}
          routeName={data.routeName}
          status={data.tripStatus}
          completed={completed}
          total={data.stops.length}
          cargoKg={data.cargoKg}
          cargoVolume={data.cargoVolume}
          onContinue={onContinue}
        />

        <View style={styles.seqHead}>
          <Text style={styles.seqTitle}>STOP SEQUENCE ({data.stops.length} STOPS)</Text>
          <View style={styles.auto}>
            <MaterialCommunityIcons name="auto-fix" size={14} color={V.primary} />
            <Text style={styles.autoText}>Auto-Optimized</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          {data.stops.map((stop) =>
            stop.status === "current" ? (
              <NextStopCard key={stop.id} stop={stop} onPress={() => onStopPress?.(stop)} />
            ) : (
              <StopRow key={stop.id} stop={stop} onPress={() => onStopPress?.(stop)} />
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V.bg },
  content: { padding: 14, gap: 16, paddingBottom: 28 },
  seqHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginTop: 2,
  },
  seqTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: "#6B7390" },
  auto: { flexDirection: "row", alignItems: "center", gap: 4 },
  autoText: { fontSize: 11.5, fontWeight: "800", color: V.primary },
});