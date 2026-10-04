import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { K } from "../../theme/conflictColors";
import { InfoCard } from "../tripready/components/InfoCard";
import { ConflictHeader } from "./components/ConflictHeader";
import { ConflictBanner } from "./components/ConflictBanner";
import { RouteConflictSnapshot } from "./types";

type Props = {
  data: RouteConflictSnapshot;
  onAcknowledge?: () => void;
  onContactDispatcher?: () => void;
  onCheckPendingPhoto?: () => void;
};

export function RouteConflictScreen({
  data,
  onAcknowledge,
  onContactDispatcher,
  onCheckPendingPhoto,
}: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ConflictHeader
        vehicle={data.vehicle}
        depot={data.depot}
        attentionCount={data.attentionCount}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Route conflict retained</Text>

        <ConflictBanner
          title="Your field record is kept"
          body={`Stop ${data.stopNo} was moved to ${data.newVehicle} while you were offline, but you had already arrived. Your record was retained and sent to the dispatcher.`}
        />

        <InfoCard
          large
          title="Dispatch review required"
          lines={[
            `Arrival capture: ${data.arrivalAt} on this phone`,
            `Plan revision: reassigned to ${data.newVehicle}`,
            "Dispatch will resolve the allocation.",
          ]}
        />

        <Pressable
          onPress={onAcknowledge}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.primaryText}>Acknowledge and view trip</Text>
        </Pressable>

        <Pressable
          onPress={onContactDispatcher}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>Contact dispatcher</Text>
        </Pressable>

        <Pressable
          onPress={onCheckPendingPhoto}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>Check pending photo</Text>
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