import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onConfirmIdentity: () => void;
  onUseShiftPin: () => void;
};

export function BiometricSignInModal({ visible, onConfirmIdentity, onUseShiftPin }: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Biometric sign-in"
      message="Confirm your identity using the device biometric prompt. This prototype uses a demonstration result."
      confirmLabel="Confirm identity"
      cancelLabel="Use shift PIN"
      onConfirm={onConfirmIdentity}
      onCancel={onUseShiftPin}
    />
  );
}