import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { L } from "../../theme/loginColors";

type Props = {
  visible: boolean;
  vehicle: string;
  note?: string; // optional dispatcher note; the line is hidden when empty
  reasonLabel: string;
  outlet: string;
  arrival: string;
  completion: string;
  onNextStop: () => void;
  onReviewRecord: () => void;
  onClose?: () => void;
};

export function FailureSavedModal({
  visible,
  vehicle,
  note,
  reasonLabel,
  outlet,
  arrival,
  completion,
  onNextStop,
  onReviewRecord,
  onClose,
}: Props) {
  const close = onClose ?? onReviewRecord;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        {/* tapping outside the card closes the popup */}
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} />

        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.head}>
            <Text style={styles.title}>Failure record saved</Text>
            <Pressable
              onPress={close}
              style={styles.close}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={16} color={L.text} />
            </Pressable>
          </View>

          <Text style={styles.body}>
            The reason, note and optional evidence are retained. Dispatch is notified when
            connected. Goods remain on {vehicle} for return to the depot.
          </Text>

          {note && note.trim().length > 0 ? <Text style={styles.line}>{note}</Text> : null}
          <Text style={styles.line}>{reasonLabel}</Text>
          <Text style={styles.line}>{outlet}</Text>

          <Text style={styles.times}>
            Arrival {arrival} · completion {completion}
          </Text>

          <Pressable
            onPress={onNextStop}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryText}>Next stop</Text>
          </Pressable>

          <Pressable
            onPress={onReviewRecord}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.secondaryText}>Review saved record</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(28,33,52,0.5)",
  },
  card: {
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#fff",
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: { flex: 1, fontSize: 20, fontWeight: "800", color: L.text, marginTop: 2 },
  close: {
    width: 56,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E6",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7390",
    marginTop: 14,
  },
  line: { fontSize: 14, color: L.text, marginTop: 16 },
  times: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7390",
    marginTop: 16,
  },
  primary: {
    height: 56,
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: L.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondary: {
    height: 56,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E6",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: L.text, fontSize: 16, fontWeight: "800" },
});