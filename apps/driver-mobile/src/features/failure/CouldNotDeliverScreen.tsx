import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { F } from "../../theme/failureColors";
import { REASONS } from "./reasons";
import { FailurePayload, FailureReasonCode, FailureStopSnapshot } from "./types";
import { FailureHeader } from "./components/FailureHeader";
import { StopSummaryCard } from "./components/StopSummaryCard";
import { ReasonPicker } from "./components/ReasonPicker";
import { EvidenceCard } from "./components/EvidenceCard";
import { FailureSubmitBar } from "./components/FailureSubmitBar";

type Props = {
  data: FailureStopSnapshot;
  initialReason?: FailureReasonCode | null;
  onBack?: () => void;
  onOpenStop?: () => void;
  onTakePhoto?: () => void;
  onSubmit?: (payload: FailurePayload) => void;
};

export function CouldNotDeliverScreen({
  data,
  initialReason = null,
  onBack,
  onOpenStop,
  onTakePhoto,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState<FailureReasonCode | null>(initialReason);

  const selected = REASONS.find((r) => r.code === reason) ?? null;
  const photoAttached = data.evidence !== null;
  const canSubmit = selected !== null && photoAttached;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <FailureHeader vehicle={data.vehicle} syncLabel={data.syncLabel} onBack={onBack}>
        <StopSummaryCard
          stopNo={data.stopNo}
          outletCode={data.outletCode}
          tag={data.tag}
          outletName={data.outletName}
          location={data.location}
          onPress={onOpenStop}
        />
      </FailureHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Select primary reason for delivery failure:</Text>
          <Text style={styles.required}>REQUIRED</Text>
        </View>

        <ReasonPicker reasons={REASONS} value={reason} onChange={setReason} />

        {selected ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.evidenceTitle}>Evidence & Documentation:</Text>
            <EvidenceCard
              prompt={selected.evidencePrompt}
              evidence={data.evidence}
              onCapture={onTakePhoto}
            />
          </View>
        ) : null}
      </ScrollView>

      <FailureSubmitBar
        disabled={!canSubmit}
        onPress={() => {
          if (selected) onSubmit?.({ reason: selected.code, photoAttached });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: F.bg },
  content: { padding: 16, gap: 18 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heading: { flex: 1, fontSize: 17, fontWeight: "800", lineHeight: 23, color: F.text },
  required: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: F.primary,
  },
  evidenceTitle: { fontSize: 17, fontWeight: "800", color: F.text },
});