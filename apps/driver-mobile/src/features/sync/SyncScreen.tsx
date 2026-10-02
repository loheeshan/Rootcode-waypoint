import { View, Text, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { S } from "../../theme/syncColors";
import { SyncSnapshot } from "./types";
import { SyncHeader } from "./components/SyncHeader";
import { DegradationCard } from "./components/DegradationCard";
import { QueueItem } from "./components/QueueItem";
import { InfoNote } from "./components/InfoNote";

type Props = {
  data: SyncSnapshot;
  onRetry?: () => void;
};

export function SyncScreen({ data, onRetry }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SyncHeader
        vehicle={data.vehicle}
        depot={data.depot}
        offlineCount={data.items.length}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <DegradationCard
          corridor={data.corridor}
          offlineSince={data.offlineSince}
          offlineDuration={data.offlineDuration}
          offlineRegion={data.offlineRegion}
          signalText={data.signalText}
          signalPct={data.signalPct}
          onRetry={onRetry}
        />

        <View style={styles.queueHeader}>
          <View style={styles.queueTitleRow}>
            <Ionicons name="save-outline" size={18} color={S.text} />
            <Text style={styles.queueTitle}>
              Local Storage Queue ({data.items.length})
            </Text>
          </View>
          <Text style={styles.ready}>READY TO SYNC</Text>
        </View>

        <View style={{ gap: 12 }}>
          {data.items.map((item) => (
            <QueueItem key={item.id} item={item} />
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <InfoNote lastHeard={data.dispatcherLastHeard} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.bg },
  content: { padding: 16, paddingBottom: 24 },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  queueTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  queueTitle: { fontSize: 16, fontWeight: "800", color: S.text },
  ready: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: S.green },
});