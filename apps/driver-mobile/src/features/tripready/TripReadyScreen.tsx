import { View, Text, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Y } from "../../theme/readyColors";
import { ReadyStop, TripReadySnapshot } from "./types";
import { ReadyHeader } from "./components/ReadyHeader";
import { DownloadedBanner } from "./components/DownloadBanner";
import { InfoCard } from "./components/InfoCard";

type Props = { data: TripReadySnapshot };

const formatNumber = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const STATUS_LABEL: Record<ReadyStop["status"], string> = {
  upcoming: "Upcoming",
  done: "Done",
};

export function TripReadyScreen({ data }: Props) {
  const total = data.stops.length;
  const done = data.stops.filter((s) => s.status === "done").length;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReadyHeader vehicle={data.vehicle} depot={data.depot} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Trip ready to depart</Text>

        <DownloadedBanner
          tripLabel={data.tripLabel}
          sector={data.sector}
          stopCount={total}
          loadedBy={data.loadedBy}
          seal={data.seal}
        />

        <InfoCard
          large
          title={`Departure ${data.departure}`}
          lines={[
            `${data.vehicle} · ${data.vehicleType}`,
            `${formatNumber(data.weightKg)} kg / ${data.volume} · ${done}/${total} done`,
          ]}
        />

        {data.stops.map((stop) => (
          <InfoCard
            key={stop.id}
            title={`Stop ${stop.stopNo} · ${stop.outlet}`}
            lines={[
              `Window ${stop.windowStart}–${stop.windowEnd} · ${STATUS_LABEL[stop.status]}`,
            ]}
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