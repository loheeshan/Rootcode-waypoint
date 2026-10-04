import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { K } from "../../theme/conflictColors";
import { ConflictBanner } from "../routeconflict/components/ConflictBanner";
import { DownloadHeader } from "./components/DownloadHeader";
import { RouteDownloadSnapshot } from "./types";

type Props = {
  data: RouteDownloadSnapshot;
  onRetry?: () => void;
  onUseSaved?: () => void;
};

export function RouteDownloadScreen({ data, onRetry, onUseSaved }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <DownloadHeader
        vehicle={data.vehicle}
        depot={data.depot}
        pillLabel={data.pillLabel}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Route download interrupted</Text>

        <ConflictBanner
          title="Download incomplete"
          body="Stay at the depot until the route, outlet details and proof templates are saved. Previously saved work is intact."
        />

        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.primaryText}>Retry download</Text>
        </Pressable>

        <Pressable
          onPress={onUseSaved}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>Use already saved trip</Text>
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