import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { F } from "../../../theme/failureColors";
import { OfflineEvidence } from "../types";

type Props = {
  prompt: string;
  evidence: OfflineEvidence | null;
  onRetake?: () => void;
};

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function PhotoEvidenceCard({ prompt, evidence, onRetake }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.prompt}>{prompt}</Text>
        {evidence ? (
          <View style={styles.attached}>
            <Ionicons name="checkmark" size={16} color={F.green} />
            <Text style={styles.attachedText}>Attached</Text>
          </View>
        ) : null}
      </View>

      {evidence ? (
        <View style={styles.body}>
          {/* TODO(feature/driver-pod-ui): show the real captured photo here */}
          <View style={styles.thumb}>
            <MaterialCommunityIcons name="image-outline" size={26} color="#9AA3BC" />
            <View style={styles.camBadge}>
              <MaterialCommunityIcons name="camera" size={10} color="#fff" />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.fileName} numberOfLines={1}>
              {evidence.fileName}
            </Text>
            <Text style={styles.meta}>{evidence.meta}</Text>
            <Pressable onPress={onRetake} style={styles.retake}>
              <MaterialCommunityIcons name="camera-retake-outline" size={16} color={F.primary} />
              <Text style={styles.retakeText}>Retake Photo</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={onRetake} style={styles.capture}>
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
    borderRadius: 14,
    backgroundColor: F.card,
    borderWidth: 1,
    borderColor: F.border,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  prompt: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#6B7390",
  },
  attached: { flexDirection: "row", alignItems: "center", gap: 3 },
  attachedText: { fontSize: 13, fontWeight: "700", color: F.green },
  body: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: "#3A404F",
    alignItems: "center",
    justifyContent: "center",
  },
  camBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(20,26,50,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { fontSize: 15, fontWeight: "800", color: F.text },
  meta: { fontSize: 11, color: F.muted, marginTop: 4, fontFamily: MONO },
  retake: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: F.infoBg,
    borderWidth: 1,
    borderColor: "#D5DFF7",
  },
  retakeText: { fontSize: 13, fontWeight: "700", color: F.primary },
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