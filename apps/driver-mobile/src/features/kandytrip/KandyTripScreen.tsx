import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Y } from "../../theme/readyColors";
import { ReadyHeader } from "../tripready/components/ReadyHeader";
import { InfoCard } from "../tripready/components/InfoCard";
import { AckBanner } from "./components/AckBanner";
import { KandyStop, KandyTripSnapshot } from "./types";

type Props = {
  data: KandyTripSnapshot;
  onViewSync?: () => void;
};

function describe(s: KandyStop): string {
  switch (s.status) {
    case "delivered":
      return `Delivered · ${s.capturedAt ?? "--:--"}`;
    case "partial":
      return `${s.partialLabel ?? "Partial"} · ${s.capturedAt ?? "--:--"}`;
    case "removed":
      return "Removed · record retained · dispatcher reviewing";
  }
}

export function KandyTripScreen({ data, onViewSync }: Props) {
  const removed = data.stops.filter((s) => s.status === "removed").map((s) => s.stopNo);
  const removedText =
    removed.length === 1
      ? `Stop ${removed[0]} removed.`
      : `Stops ${removed.join(", ")} removed.`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReadyHeader vehicle={data.vehicle} depot={data.depot} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Kandy trip stops</Text>

        {removed.length > 0 ? (
          <AckBanner
            title="Updated route acknowledged"
            body={`${removedText} Your arrival record is retained for dispatch review.`}
          />
        ) : null}

        {data.stops.map((s) => (
          <InfoCard
            key={s.id}
            large
            title={`Stop ${s.stopNo} · ${s.outlet}`}
            lines={[describe(s)]}
          />
        ))}

        <Pressable
          onPress={onViewSync}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.primaryText}>View sync status</Text>
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
});