import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { F } from "../../../theme/failureColors";

type Props = {
  note: string;
  onNoteChange: (v: string) => void;
  disabled?: boolean;
  onSubmit?: () => void;
};

export function SubmitSection({ note, onNoteChange, disabled = false, onSubmit }: Props) {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.noteCard}>
        <Text style={styles.noteLabel}>NOTE FOR DISPATCHER (OPTIONAL)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={onNoteChange}
          placeholder="Add details about the delivery failure"
          placeholderTextColor="#A5ADC6"
          multiline
        />
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={disabled}
        style={({ pressed }) => [
          styles.cta,
          disabled && styles.ctaDisabled,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Ionicons name="alert-circle-outline" size={20} color="#fff" />
        <Text style={styles.ctaText}>Queue Failed Delivery</Text>
      </Pressable>

      <View style={styles.savedRow}>
        <View style={styles.dot} />
        <Text style={styles.saved}>Saved on phone — will sync automatically when online</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noteCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: F.card,
    borderWidth: 1,
    borderColor: F.border,
  },
  noteLabel: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, color: "#6B7390" },
  noteInput: {
    minHeight: 54,
    marginTop: 8,
    fontSize: 14,
    color: F.text,
    textAlignVertical: "top",
  },
  cta: {
    height: 54,
    borderRadius: 14,
    backgroundColor: F.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaDisabled: { backgroundColor: "#9AA9E6" },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  savedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: F.green },
  saved: { fontSize: 12, fontWeight: "600", color: F.green },
});