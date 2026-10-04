import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Y } from "../../theme/readyColors";
import { ReadyHeader } from "../tripready/components/ReadyHeader";
import { AckBanner } from "../kandytrip/components/AckBanner";
import { AppSettingsSnapshot } from "./types";

type Props = {
  data: AppSettingsSnapshot;
  notificationsOn: boolean;
  onToggleNotifications?: () => void;
  onLanguage?: () => void;
  onOfflineStorage?: () => void;
  onPermissions?: () => void;
  onBack?: () => void;
};

function Row({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
    >
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

export function AppSettingsScreen({
  data,
  notificationsOn,
  onToggleNotifications,
  onLanguage,
  onOfflineStorage,
  onPermissions,
  onBack,
}: Props) {
  const records = data.storedRecords === 1 ? "1 record" : `${data.storedRecords} records`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReadyHeader vehicle={data.vehicle} depot={data.depot} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>App settings</Text>

        <AckBanner
          title="Offline records stay on this phone"
          body="Automatic retry is enabled. End your shift after all records and proof have been sent."
        />

        <Row
          label={`Notifications · ${notificationsOn ? "On" : "Off"}`}
          onPress={onToggleNotifications}
        />
        <Row label={`Language · ${data.language}`} onPress={onLanguage} />
        <Row label={`Offline storage · ${records}`} onPress={onOfflineStorage} />
        <Row label={`Permissions · ${data.permissions}`} onPress={onPermissions} />
        <Row label="Back to profile" onPress={onBack} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Y.bg },
  content: { padding: 16, gap: 16, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: "800", color: Y.text, marginTop: 4 },
  row: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E6",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { color: Y.text, fontSize: 16, fontWeight: "800" },
});