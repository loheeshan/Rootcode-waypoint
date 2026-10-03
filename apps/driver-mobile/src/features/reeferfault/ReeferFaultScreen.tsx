import { View, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Z } from "../../theme/reeferColors";
import { ReeferFaultSnapshot } from "./types";
import { OfflineReadyBanner } from "../today/components/OfflineReadyBanner";
import { RunSheetHeader } from "../today/components/RunSheetHeader";
import { TripCard } from "../today/components/TripCard";
import { ReeferHeader } from "./components/ReeferHeader";
import { ActionRequiredCard } from "./components/ActionRequiredCard";
import { HeldTripCard } from "./components/HeldTripCard";

type Props = {
  data: ReeferFaultSnapshot;
  onReportIssue?: () => void;
};

export function ReeferFaultScreen({ data, onReportIssue }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReeferHeader
        greeting={data.greeting}
        syncLabel={data.syncLabel}
        vehicle={data.vehicle}
        vehicleType={data.vehicleType}
        tempC={data.tempC}
        tempStatus={data.tempStatus}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <OfflineReadyBanner />

        <ActionRequiredCard chip={data.alertChip} message={data.alertMessage} />

        <RunSheetHeader
          tripCount={2}
          outletsTotal={data.outletsTotal}
          dateLabel={data.dateLabel}
        />

        <View style={{ gap: 16 }}>
          <HeldTripCard trip={data.heldTrip} onReportIssue={onReportIssue} />
          <TripCard trip={data.waitingTrip} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Z.bg },
  content: { padding: 14, gap: 16, paddingBottom: 28 },
});