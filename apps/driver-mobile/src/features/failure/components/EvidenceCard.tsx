import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { F } from "../../../theme/failureColors";
import { FailureEvidence } from "../types";

type Props = {
  prompt: string;
  evidence: FailureEvidence | null;
  onCapture?: () => void;
};

export function EvidenceCard({ prompt, evidence, onCapture }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.prompt}>{prompt}</Text>
        {evidence ? (
          <View style={styles.attached}>
            <Ionicons name="checkmark-circle-outline" size={16} color={F.green} />
            <Text style={styles.attachedText}>Attached</Text>
          </View>
        ) : null}
      </View>

      {evidence ? (
        <View style={styles.photoRow}>
          {/* TODO(feature/driver-pod-ui): show the real captured photo here */}
          <View style={styles.thumb}>
            <MaterialCommunityIcons name="image-outline" size={26} color="#8C97C4" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.caption}>{evidence.caption}</Text>
            <Text style={styles.meta}>{evidence.meta}</Text>
          </View>
          <Pressable onPress={onCapture} style={styles.retake} hitSlop={6}>
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onCapture} style={styles.capture}>
          <MaterialCommunityIcons name="camera-outline" size={20} color={F.primary} />
          <Text style={styles.captureText}>Take photo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: F.card,
    borderWidth: 1,
    borderColor: F.border,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  prompt: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    lineHeight: 16,
    color: "#6B7390",
  },
  attached: { flexDirection: "row", alignItems: "center", gap: 4 },
  attachedText: { fontSize: 13, fontWeight: "700", color: F.green },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: F.navyDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: { fontSize: 15, fontWeight: "800", color: F.text },
  meta: { fontSize: 12, color: F.muted, marginTop: 3 },
  retake: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: F.infoBg,
  },
  retakeText: { fontSize: 12, fontWeight: "800", color: F.primary },
  capture: {
    marginTop: 12,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: F.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  captureText: { fontSize: 14, fontWeight: "700", color: F.primary },
});