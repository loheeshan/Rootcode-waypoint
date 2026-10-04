import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Y } from "../../theme/readyColors";
import { ReadyHeader } from "../tripready/components/ReadyHeader";
import { InfoCard } from "../tripready/components/InfoCard";
import { ProfileSnapshot } from "./types";

type Props = {
  data: ProfileSnapshot;
  onSettings?: () => void;
  onNotifications?: () => void;
  onVehicleDetails?: () => void;
  onHelp?: () => void;
  onEndShift?: () => void;
};

const END_RED = "#DC3E4A";

export function ProfileScreen({
  data,
  onSettings,
  onNotifications,
  onVehicleDetails,
  onHelp,
  onEndShift,
}: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReadyHeader vehicle={data.vehicle} depot={data.depot} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Driver profile</Text>

        <InfoCard
          large
          title={data.name}
          lines={[
            `${data.driverId} · ${data.homeDepot}`,
            `Assigned ${data.vehicle} · ${data.vehicleType}`,
          ]}
        />

        <Pressable
          onPress={onSettings}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.primaryText}>Settings</Text>
        </Pressable>

        <Pressable
          onPress={onNotifications}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>Notifications</Text>
        </Pressable>

        <Pressable
          onPress={onVehicleDetails}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>Vehicle and shift details</Text>
        </Pressable>

        <Pressable
          onPress={onHelp}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryText}>Help and dispatcher contact</Text>
        </Pressable>

        <Pressable
          onPress={onEndShift}
          style={({ pressed }) => [styles.end, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.endText}>End shift</Text>
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
  end: {
    height: 56,
    borderRadius: 14,
    backgroundColor: END_RED,
    alignItems: "center",
    justifyContent: "center",
  },
  endText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});