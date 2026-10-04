import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { L } from "../../theme/loginColors";

type Props = {
  visible: boolean;
  fileName: string;
  onKeepWorking: () => void;
  onClose?: () => void;
};

export function UploadingPhotoModal({ visible, fileName, onKeepWorking, onClose }: Props) {
  const close = onClose ?? onKeepWorking;

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
            <Text style={styles.title}>Uploading photo…</Text>
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
            The delivery record is already sent. Only {fileName} is being retried.
          </Text>

          <Pressable
            onPress={onKeepWorking}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.secondaryText}>Keep working</Text>
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
  secondary: {
    height: 56,
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E6",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: L.text, fontSize: 16, fontWeight: "800" },
});