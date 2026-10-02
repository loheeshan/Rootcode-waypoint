import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  contactName: string; // e.g. "Nasser"
  deskLabel: string;   // e.g. "OUT017 receiving desk"
  locationNote: string; // e.g. "Gate B, rear dock"
  onConfirm: () => void;
  onCancel: () => void;
};

export function CallReceiverModal({
  visible,
  contactName,
  deskLabel,
  locationNote,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Call the receiver"
      message={`${contactName} · ${deskLabel}\n${locationNote}. This prototype demonstrates the call handoff without making a phone call.`}
      confirmLabel="Show call handoff"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
