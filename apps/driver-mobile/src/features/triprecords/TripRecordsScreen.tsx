import { View, Text, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Y } from "../../theme/readyColors";
import { ReadyHeader } from "../tripready/components/ReadyHeader";
import { InfoCard } from "../tripready/components/InfoCard";
import { TripRecord, TripRecordsSnapshot } from "./types";

type Props = { data: TripRecordsSnapshot };

function describe(r: TripRecord): string {
  switch (r.status) {
    case "delivered":
      return `Delivered · captured ${r.capturedAt ?? "--:--"}`;
    case "partial":
      return `Partial · captured ${r.capturedAt ?? "--:--"}`;
    case "failed":
      return `Not delivered · ${r.reason ?? "no reason recorded"} · ${r.capturedAt ?? "--:--"}`;
    case "removed":
      return "Removed by dispatcher";
  }
}

export function TripRecordsScreen({ data }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReadyHeader vehicle={data.vehicle} depot={data.depot} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Trip delivery records</Text>

        {data.records.map((r) => (
          <InfoCard
            key={r.id}
            title={`Stop ${r.stopNo} · ${r.outlet}`}
            lines={[describe(r)]}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Y.bg },
  content: { padding: 16, gap: 16, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: "800", color: Y.text, marginTop: 4 },
});