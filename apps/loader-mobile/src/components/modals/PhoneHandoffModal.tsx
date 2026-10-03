import React from 'react';
import { NoticeModal } from './NoticeModal';

type Props = {
  visible: boolean;
  onReturn: () => void;
};

export function PhoneHandoffModal({ visible, onReturn }: Props) {
  return (
    <NoticeModal
      visible={visible}
      title="Phone handoff"
      message="Call request preview · no call is placed in this prototype."
      buttonLabel="Return to app"
      onDismiss={onReturn}
    />
  );
}
