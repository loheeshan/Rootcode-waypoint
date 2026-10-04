import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Y } from "../../theme/readyColors";
import { ReadyHeader } from "../tripready/components/ReadyHeader";
import { InfoCard } from "../tripready/components/InfoCard";
import { CompleteBanner } from "./components/CompleteBanner";
import { TripCompleteSnapshot } from "./types";

type Props = {
  data: TripCompleteSnapshot;
  onReviewRecords?: () => void;
  onViewSync?: () => void;
  onBackToToday?: () => void;
};

export function TripCompleteScreen({
  data,
  onReviewRecords,
  onViewSync,
  onBackToToday,
}: Props) {
  const removed =
    data.removedStop !== undefined ? ` · stop ${data.removedStop} removed by dispatch` : "";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReadyHeader vehicle={data.vehicle} depot={data.depot} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Trip complete</Text>

        <CompleteBanner
          title="All active stops recorded"
          body={`${data.activeStops} active stops finished${removed}. Departure ${data.departure} · final capture ${data.finalCapture}.`}
        />

        <InfoCard
          title={`${data.tripLabel} · ${data.depot}`}
          lines={[
            `All active stops have a saved outcome. Returned goods remain on ${data.vehicle}.`,
          ]}
        />

        <Pressable
          onPress={onReviewRecords}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.primaryText}>Review trip records</Text>
        </Pressable>

        <Pressable
          onPress={onViewSync}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>View sync status</Text>
        </Pressable>

        <Pressable
          onPress={onBackToToday}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>Back to today</Text>
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