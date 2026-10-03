import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { K } from "../../theme/conflictColors";
import { InfoCard } from "../tripready/components/InfoCard";
import { ConflictHeader } from "../routeconflict/components/ConflictHeader";
import { ConflictBanner } from "../routeconflict/components/ConflictBanner";
import { PhotoAttentionSnapshot } from "./types";

type Props = {
  data: PhotoAttentionSnapshot;
  onRetry?: () => void;
  onContinue?: () => void;
};

export function PhotoAttentionScreen({ data, onRetry, onContinue }: Props) {
  const count = data.photos.length;
  const title = count === 1 ? "1 photo needs attention" : `${count} photos need attention`;
  const stored =
    count === 1
      ? "One POD photo is still stored on this phone and needs another upload attempt."
      : `${count} POD photos are still stored on this phone and need another upload attempt.`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ConflictHeader
        vehicle={data.vehicle}
        depot={data.depot}
        attentionCount={count}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>{title}</Text>

        <ConflictBanner
          title="Nothing is lost"
          body={`The delivery record is sent. ${stored}`}
        />

        {data.photos.map((p) => (
          <InfoCard
            key={p.id}
            large
            title={p.fileName}
            lines={[
              `Stop ${p.stopNo} · ${p.outlet} · captured ${p.capturedAt}`,
              "Queued locally · photo only",
            ]}
          />
        ))}

        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.primaryText}>Retry photo upload</Text>
        </Pressable>

        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>Continue working</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: K.bg },
  content: { padding: 16, gap: 16, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: "800", color: K.text, marginTop: 4 },
  primary: {
    height: 56,
    borderRadius: 14,
    backgroundColor: K.primary,
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
  secondaryText: { color: K.text, fontSize: 16, fontWeight: "800" },
});