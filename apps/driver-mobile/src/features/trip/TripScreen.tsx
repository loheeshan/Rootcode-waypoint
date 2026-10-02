import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { T } from "../../theme/tripColors";
import { TripSnapshot, TripStop } from "./types";
import { TripHeader } from "./components/TripHeader";
import { RevisionBanner } from "./components/RevisionBanner";
import { TripSummaryCard } from "./components/TripSummaryCard";
import { StopSequence } from "./components/StopSequence";

type Props = {
  data: TripSnapshot;
  onContinue?: () => void;
  onStopPress?: (stop: TripStop) => void;
};

const DONE: TripStop["status"][] = ["delivered", "partial", "failed"];

export function TripScreen({ data, onContinue, onStopPress }: Props) {
  const [showBanner, setShowBanner] = useState(data.routeRevision !== null);

  const completed = data.stops.filter((s) => DONE.includes(s.status)).length;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <TripHeader
        driverName={data.driverName}
        vehicle={data.vehicle}
        syncLabel={data.syncLabel}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {showBanner && data.routeRevision ? (
          <RevisionBanner
            message={data.routeRevision}
            onDismiss={() => setShowBanner(false)}
          />
        ) : null}

        <TripSummaryCard
          tripLabel={data.tripLabel}
          routeName={data.routeName}
          status={data.tripStatus}
          completed={completed}
          total={data.stops.length}
          cargoKg={data.cargoKg}
          cargoVolume={data.cargoVolume}
          onContinue={onContinue}
        />

        <StopSequence stops={data.stops} onStopPress={onStopPress} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { padding: 16, gap: 18 },
});