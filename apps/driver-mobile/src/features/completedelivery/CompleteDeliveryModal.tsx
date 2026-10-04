import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { L } from "../../theme/loginColors";

type Props = {
  visible: boolean;
  outlet: string;
  outcome: string; // e.g. "Delivered" or "Partially delivered"
  delivered: number;
  expected: number;
  photoLine: string; // e.g. "Photo optional" or "Photo attached"
  signatureLine: string; // e.g. "Signature captured"
  receiver: string; // e.g. "Kamal Jayasuriya (Store Mgr)"
  arrival: string;
  completion: string;
  onSave: () => void;
  onKeepEditing: () => void;
  onClose?: () => void;
};

export function CompleteDeliveryModal({
  visible,
  outlet,
  outcome,
  delivered,
  expected,
  photoLine,
  signatureLine,
  receiver,
  arrival,
  completion,
  onSave,
  onKeepEditing,
  onClose,
}: Props) {
  const close = onClose ?? onKeepEditing;

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
            <Text style={styles.title}>Complete delivery?</Text>
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

          <Text style={styles.review}>Review the field record before saving.</Text>

          <Text style={styles.outlet}>{outlet}</Text>

          <Text style={styles.summary}>
            {outcome} · {delivered}/{expected} cartons
          </Text>
          <Text style={styles.line}>{photoLine}</Text>
          <Text style={styles.line}>{signatureLine}</Text>
          <Text style={styles.line}>{receiver}</Text>

          <View style={styles.timeBox}>
            <Text style={styles.timeTitle}>Capture time stays unchanged</Text>
            <Text style={styles.timeBody}>
              Arrival {arrival} · completion {completion}
            </Text>
          </View>

          <Pressable
            onPress={onSave}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryText}>Save delivery</Text>
          </Pressable>

          <Pressable
            onPress={onKeepEditing}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.secondaryText}>Keep editing</Text>
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
  review: { fontSize: 14, color: "#6B7390", marginTop: 14 },
  outlet: { fontSize: 18, fontWeight: "800", color: L.text, marginTop: 16 },
  summary: { fontSize: 14, color: L.text, marginTop: 18 },
  line: { fontSize: 14, color: "#6B7390", marginTop: 14 },
  timeBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#EEF3FD",
  },
  timeTitle: { fontSize: 15, fontWeight: "800", color: L.primary },
  timeBody: { fontSize: 14, color: L.text, marginTop: 8 },
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