import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Y } from "../../theme/readyColors";
import { ReadyHeader } from "../tripready/components/ReadyHeader";
import { InfoCard } from "../tripready/components/InfoCard";
import { VehicleShiftSnapshot } from "./types";

type Props = {
  data: VehicleShiftSnapshot;
  onReportIssue?: () => void;
  onViewChecklist?: () => void;
};

export function VehicleShiftScreen({ data, onReportIssue, onViewChecklist }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReadyHeader vehicle={data.vehicle} depot={data.depot} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Vehicle and shift</Text>

        <InfoCard
          large
          title={`${data.vehicle} · ${data.vehicleType}`}
          lines={[
            `Driver ${data.driverName} · ${data.driverId}`,
            `${data.fleet} · ${data.shiftStatus}`,
          ]}
        />

        <InfoCard
          large
          title="Pre-trip check"
          lines={[
            `Chilled lock ${data.chilledLock} · battery ${data.battery}`,
            `Fuel ${data.fuelPercent}% · loaded seal ${data.seal}`,
          ]}
        />

        <Pressable
          onPress={onReportIssue}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.primaryText}>Report vehicle issue</Text>
        </Pressable>

        <Pressable
          onPress={onViewChecklist}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>View departure checklist</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Y.bg },
  content: { padding: 16, gap: 16, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: "800", color: Y.text, marginTop: 4 },
  primary: {
    height: 56,
    borderRadius: 14,
    backgroundColor: Y.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondary: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E6",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: Y.text, fontSize: 16, fontWeight: "800" },
});