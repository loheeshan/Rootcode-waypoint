import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  /** e.g. "damaged crate and order label at Bay B-04" */
  description: string;
  /** e.g. "POD_BAY04_0312.jpg" */
  fileName: string;
  /** e.g. "03:12" */
  capturedAt: string;
  onUseEvidence: () => void;
  onRetake: () => void;
  onClose: () => void;
};

export function EvidenceReadyModal({
  visible,
  description,
  fileName,
  capturedAt,
  onUseEvidence,
  onRetake,
  onClose,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Evidence ready"
      message={`Sample evidence: ${description}.\n${fileName} · captured ${capturedAt}`}
      confirmLabel="Use this evidence"
      cancelLabel="Retake"
      onConfirm={onUseEvidence}
      onCancel={onRetake}
      onClose={onClose}
    />
  );
}