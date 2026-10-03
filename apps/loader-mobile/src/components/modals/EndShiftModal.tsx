import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onSignOut: () => void;
  onKeepWorking: () => void;
};

export function EndShiftModal({ visible, onSignOut, onKeepWorking }: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="End this shift?"
      message="Synced work stays on the manifest. Any local queue remains saved on this device for the next authorised sign-in."
      confirmLabel="Sign out of this device"
      cancelLabel="Keep working"
      onConfirm={onSignOut}
      onCancel={onKeepWorking}
    />
  );
}