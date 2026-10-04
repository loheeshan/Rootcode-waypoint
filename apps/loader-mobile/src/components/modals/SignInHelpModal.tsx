import React from 'react';
import { NoticeModal } from './NoticeModal';

type Props = {
  visible: boolean;
  onBackToSignIn: () => void;
};

export function SignInHelpModal({ visible, onBackToSignIn }: Props) {
  return (
    <NoticeModal
      visible={visible}
      title="Sign-in help"
      message="Contact the depot supervisor to check your bay-lead access. Saved local records stay on this device."
      buttonLabel="Back to sign in"
      onDismiss={onBackToSignIn}
    />
  );
}