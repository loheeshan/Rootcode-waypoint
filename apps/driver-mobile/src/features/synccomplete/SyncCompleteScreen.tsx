import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Y } from "../../theme/readyColors";
import { ReadyHeader } from "../tripready/components/ReadyHeader";
import { InfoCard } from "../tripready/components/InfoCard";
import { CompleteBanner } from "../tripcomplete/components/CompleteBanner";
import { SyncedRecord, SyncCompleteSnapshot } from "./types";

type Props = {
  data: SyncCompleteSnapshot;
  onReviewRouteUpdate?: () => void;
};

function recordTitle(r: SyncedRecord): string {
  const outcome = r.outcome === "partial" ? r.partialLabel ?? "Partial" : "Delivered";
  return `Stop ${r.stopNo} · ${r.outlet} · ${outcome}`;
}

export function SyncCompleteScreen({ data, onReviewRouteUpdate }: Props) {
  const count = data.records.length + (data.routeUpdate ? 0 : 0);
  const updates = count === 1 ? "1 update" : `${count} updates`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReadyHeader vehicle={data.vehicle} depot={data.depot} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Sync complete</Text>

        <CompleteBanner
          title={`${updates} sent at ${data.sentAt}`}
          body="All delivery records are synced once. Their original phone capture times are unchanged."
        />

        {data.routeUpdate ? (
          <InfoCard title={data.routeUpdate.title} lines={[data.routeUpdate.body]} />
        ) : null}

        {data.records.map((r) => (
          <InfoCard
            key={r.id}
            title={recordTitle(r)}
            lines={[`Captured ${r.capturedAt} · sent ${r.sentAt}`]}
          />
        ))}

        {data.routeUpdate ? (
          <Pressable
            onPress={onReviewRouteUpdate}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryText}>Review route update</Text>
          </Pressable>
        ) : null}
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