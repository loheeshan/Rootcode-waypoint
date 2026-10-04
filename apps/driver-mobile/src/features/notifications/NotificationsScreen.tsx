import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Y } from "../../theme/readyColors";
import { ReadyHeader } from "../tripready/components/ReadyHeader";
import { InfoCard } from "../tripready/components/InfoCard";
import { NotificationItem, NotificationsSnapshot } from "./types";

type Props = {
  data: NotificationsSnapshot;
  onAction?: (item: NotificationItem) => void;
};

export function NotificationsScreen({ data, onAction }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ReadyHeader vehicle={data.vehicle} depot={data.depot} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Notifications</Text>

        {data.items.length === 0 ? (
          <Text style={styles.empty}>No notifications</Text>
        ) : null}

        {data.items.map((item) => (
          <View key={item.id} style={styles.group}>
            <InfoCard large title={item.title} lines={[item.body]} />

            <Pressable
              onPress={() => onAction?.(item)}
              style={({ pressed }) => [
                item.primary ? styles.primary : styles.secondary,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={item.primary ? styles.primaryText : styles.secondaryText}>
                {item.actionLabel}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Y.bg },
  content: { padding: 16, gap: 16, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: "800", color: Y.text, marginTop: 4 },
  empty: { fontSize: 14, color: Y.muted },
  group: { gap: 16 },
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