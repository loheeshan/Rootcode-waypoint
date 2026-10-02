import { View, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { R } from "../../theme/todayColors";
import { TodaySnapshot, TripData } from "./types";
import { TodayHeader } from "./components/TodayHeader";
import { OfflineReadyBanner } from "./components/OfflineReadyBanner";
import { RunSheetHeader } from "./components/RunSheetHeader";
import { TripCard } from "./components/TripCard";

type Props = {
  data: TodaySnapshot;
  onViewStops?: (trip: TripData) => void;
};

export function TodayScreen({ data, onViewStops }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <TodayHeader
        greeting={data.greeting}
        syncLabel={data.syncLabel}
        vehicle={data.vehicle}
        vehicleType={data.vehicleType}
        tempC={data.tempC}
        tempLocked={data.tempLocked}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <OfflineReadyBanner />

        <RunSheetHeader
          tripCount={data.trips.length}
          outletsTotal={data.outletsTotal}
          dateLabel={data.dateLabel}
        />

        <View style={{ gap: 16 }}>
          {data.trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} onViewStops={onViewStops} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },
  content: { padding: 16, gap: 18 },
});