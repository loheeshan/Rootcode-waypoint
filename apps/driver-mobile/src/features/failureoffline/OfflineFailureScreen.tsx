import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { F } from "../../theme/failureColors";
import { REASONS } from "../failure/reasons";
import { FailurePayload, FailureReasonCode } from "../failure/types";
import { OfflineFailureSnapshot } from "./types";
import { OfflineHeader } from "./components/OfflineHeader";
import { ReasonList } from "./components/ReasonList";
import { PhotoEvidenceCard } from "./components/PhotoEvidenceCard";
import { SubmitSection } from "./components/SubmitSection";

type Props = {
  data: OfflineFailureSnapshot;
  initialReason?: FailureReasonCode | null;
  onBack?: () => void;
  onOpenStop?: () => void;
  onRetakePhoto?: () => void;
  onSubmit?: (payload: FailurePayload & { note: string }) => void;
};

export function OfflineFailureScreen({
  data,
  initialReason = null,
  onBack,
  onOpenStop,
  onRetakePhoto,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState<FailureReasonCode | null>(initialReason);
  const [note, setNote] = useState("");

  const selected = REASONS.find((r) => r.code === reason) ?? null;
  const photoAttached = data.evidence !== null;
  const canSubmit = selected !== null && photoAttached;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <OfflineHeader data={data} onBack={onBack} onOpenStop={onOpenStop} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.headingRow}>
          <Text style={styles.heading}>SELECT PRIMARY REASON FOR DELIVERY FAILURE:</Text>
          <Text style={styles.required}>REQUIRED</Text>
        </View>

        <ReasonList value={reason} onChange={setReason} />

        {selected ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.evidenceTitle}>Evidence & Documentation:</Text>
            <PhotoEvidenceCard
              prompt={selected.evidencePrompt}
              evidence={data.evidence}
              onRetake={onRetakePhoto}
            />
          </View>
        ) : null}

        <SubmitSection
          note={note}
          onNoteChange={setNote}
          disabled={!canSubmit}
          onSubmit={() => {
            if (selected) onSubmit?.({ reason: selected.code, photoAttached, note });
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: F.bg },
  content: { padding: 14, gap: 16, paddingBottom: 28 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heading: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    lineHeight: 17,
    color: "#2B3354",
  },
  required: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, color: F.primary },
  evidenceTitle: { fontSize: 14, fontWeight: "800", color: F.text },
});