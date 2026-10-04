import {
  View,
  Text,
  Pressable,
  Modal,
  Image,
  ImageSourcePropType,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { L } from "../../theme/loginColors";

type Props = {
  visible: boolean;
  photo: ImageSourcePropType; // require("...") for a bundled image, or { uri } for a captured photo
  onUse: () => void;
  onRetake: () => void;
  onClose: () => void;
};

export function ReviewPhotoModal({ visible, photo, onUse, onRetake, onClose }: Props) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* tapping outside the card closes the popup */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />

        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.head}>
            <Text style={styles.title}>Review photo</Text>
            <Pressable
              onPress={onClose}
              style={styles.close}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={16} color={L.text} />
            </Pressable>
          </View>

          <Text style={styles.body}>Captured at the outlet on this phone.</Text>

          <Image
            source={photo}
            style={styles.photo}
            resizeMode="cover"
            accessibilityLabel="Delivery photo preview"
          />

          <Pressable
            onPress={onUse}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryText}>Use this photo</Text>
          </Pressable>

          <Pressable
            onPress={onRetake}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.secondaryText}>Retake</Text>
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
  photo: {
    width: "100%",
    aspectRatio: 310 / 220,
    marginTop: 16,
    backgroundColor: "#E9ECF3",
  },
  primary: {
    height: 56,
    marginTop: 16,
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