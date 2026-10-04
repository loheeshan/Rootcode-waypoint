import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  deskNumber: string; // e.g. "02"
  badgeId: string;    // e.g. "DRV-4018"
  onContactDispatcher: () => void;
  onBackToSignIn: () => void;
};

export function ResetShiftPinModal({
  visible,
  deskNumber,
  badgeId,
  onContactDispatcher,
  onBackToSignIn,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Reset shift PIN"
      message={`Contact dispatch desk ${deskNumber} to verify driver badge ${badgeId} and reset the shift PIN.`}
      confirmLabel="Contact dispatcher"
      cancelLabel="Back to sign-in"
      onConfirm={onContactDispatcher}
      onCancel={onBackToSignIn}
    />
  );
}