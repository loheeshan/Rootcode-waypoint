import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  vehicleId: string; // e.g. "VEH018"
  onSendIssue: () => void;
  onCancel: () => void;
};

export function ReportReeferFaultModal({ visible, vehicleId, onSendIssue, onCancel }: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Report reefer fault"
      message={`${vehicleId} · chilled hold active\nCargo cannot depart until the fault is resolved and loading is confirmed.`}
      confirmLabel="Send issue to dispatch"
      onConfirm={onSendIssue}
      onCancel={onCancel}
    />
  );
}