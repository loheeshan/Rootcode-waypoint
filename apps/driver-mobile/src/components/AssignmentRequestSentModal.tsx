import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  requestedVehicleId: string; // e.g. "VEH025"
  blockedVehicleId: string;   // e.g. "VEH018"
  onContactDispatch: () => void;
  onReturnToSignIn: () => void;
};

export function AssignmentRequestSentModal({
  visible,
  requestedVehicleId,
  blockedVehicleId,
  onContactDispatch,
  onReturnToSignIn,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Assignment request sent"
      message={`Dispatch will confirm ${requestedVehicleId} before loading starts. ${blockedVehicleId} remains blocked because another driver is signed in.`}
      confirmLabel="Contact dispatch"
      cancelLabel="Return to sign-in"
      onConfirm={onContactDispatch}
      onCancel={onReturnToSignIn}
    />
  );
}