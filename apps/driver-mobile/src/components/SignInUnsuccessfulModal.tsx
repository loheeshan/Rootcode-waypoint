import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onTryAgain: () => void;
  onForgotPin: () => void;
};

export function SignInUnsuccessfulModal({ visible, onTryAgain, onForgotPin }: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Sign-in unsuccessful"
      message="The driver ID or shift PIN could not be verified. Check your details and try again."
      confirmLabel="Try again"
      cancelLabel="Forgot PIN"
      onConfirm={onTryAgain}
      onCancel={onForgotPin}
      onClose={onTryAgain}
    />
  );
}