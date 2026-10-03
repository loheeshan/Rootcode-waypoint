import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { L } from "../../theme/loginColors";

export type PartialReason = "damaged" | "short_loaded" | "rejected";

const OPTIONS: { code: PartialReason; label: string }[] = [
  { code: "damaged", label: "Damaged" },
  { code: "short_loaded", label: "Short-loaded" },
  { code: "rejected", label: "Rejected" },
];

type Props = {
  visible: boolean;
  productName: string;
  onSelect: (reason: PartialReason) => void;
  onClose: () => void;
};

export function PartialReasonModal({ visible, productName, onSelect, onClose }: Props) {
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
            <Text style={styles.title}>Partial delivery reason</Text>
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

          <Text style={styles.body}>
            Choose a reason for this product. Ordered quantities are retained alongside
            delivered quantities.
          </Text>

          <Text style={styles.product}>{productName}</Text>

          {OPTIONS.map((o) => (
            <Pressable
              key={o.code}
              onPress={() => onSelect(o.code)}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.optionText}>{o.label}</Text>
            </Pressable>
          ))}
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
  product: {
    fontSize: 12,
    fontWeight: "800",
    color: L.primary,
    marginTop: 14,
  },
  option: {
    height: 56,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E6",
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { color: L.text, fontSize: 16, fontWeight: "800" },
});